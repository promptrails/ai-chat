import { generateId } from "../core/utils";
import type { Message, StreamEvent } from "../types";

const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const TOKEN_REFRESH_SKEW_MS = 30_000;

export type BrowserRuntimeEvent =
  | { type: "session.created" | "session.resumed" | "session.cleared"; sessionId?: string }
  | { type: "message.started"; idempotencyKey: string }
  | { type: "message.completed"; idempotencyKey: string; executionId?: string }
  | { type: "message.failed"; idempotencyKey: string; error: BrowserChatError }
  | { type: "feedback.submitted"; executionId: string; value: 1 | -1 }
  | { type: "token.refreshed"; expiresAt: number };

export interface BrowserMessageContext {
  [key: string]: unknown;
}

export interface BrowserRuntimeMessage {
  /** Text stored in chat history and displayed after a resume. */
  content: string;
  /** Structured, untrusted page context supplied separately to the agent. */
  context?: BrowserMessageContext;
  /** Stable key used when the same request must be retried. */
  idempotencyKey?: string;
}

export interface BrowserRuntimeConfig {
  /** Public browser-only API key. Never pass a management/provider key. */
  apiKey: string;
  agentId: string;
  baseUrl?: string;
  workspaceId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  persistSession?: boolean;
  sessionMaxAge?: number;
  /** Override the localStorage namespace without changing authorization. */
  storageKey?: string;
  /** Coordinates one resumable session between same-origin tabs. Defaults to true. */
  coordinateTabs?: boolean;
  /** Host-owned observability hook; the runtime never sends analytics elsewhere. */
  onEvent?: (event: BrowserRuntimeEvent) => void;
}

export interface BrowserSessionSnapshot {
  sessionId: string;
  resumeToken: string;
  lastActivityAt: number;
}

export interface BrowserSessionResponse {
  id?: string;
  session_id?: string;
  agent_id?: string;
  title?: string;
  resume_token?: string;
  created_at?: string;
}

interface BrowserMessageResponse {
  id?: string;
  role?: string;
  content?: string;
  created_at?: string;
  metadata?: Record<string, unknown>;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: string | { message?: string };
  message?: string;
}

interface SessionBroadcast {
  source: string;
  type: "session" | "clear";
  snapshot?: BrowserSessionSnapshot;
}

export class BrowserChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable = status === 0 || status === 408 || status === 429 || status >= 500,
  ) {
    super(message);
    this.name = "BrowserChatError";
  }
}

export interface BrowserChatRuntime {
  readonly sessionId: string;
  createSession(title?: string): Promise<BrowserSessionResponse>;
  hydrate(): Promise<Message[]>;
  listMessages(): Promise<Message[]>;
  sendMessageStream(
    message: BrowserRuntimeMessage,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamEvent>;
  newSession(): Promise<void>;
  submitFeedback(executionId: string, value: 1 | -1): Promise<void>;
  disconnect(): void;
}

function cleanBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function apiError(status: number, payload: ApiEnvelope<unknown>): BrowserChatError {
  const detail =
    typeof payload.error === "string"
      ? payload.error
      : payload.error?.message || payload.message || `Request failed (${status}).`;
  return new BrowserChatError(detail, status);
}

function sessionIsValid(value: Partial<BrowserSessionSnapshot>, maxAgeMs: number): boolean {
  const age = Date.now() - Number(value.lastActivityAt);
  return (
    typeof value.sessionId === "string" &&
    /^[0-9A-Za-z]{27}$/.test(value.sessionId) &&
    typeof value.resumeToken === "string" &&
    value.resumeToken.length >= 32 &&
    Number.isFinite(age) &&
    age >= 0 &&
    age <= maxAgeMs
  );
}

function messageFromApi(item: BrowserMessageResponse): Message | null {
  if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") return null;
  return {
    id: item.id || generateId(),
    role: item.role,
    content: typeof item.content === "string" ? item.content : "",
    status: "complete",
    createdAt: item.created_at ? new Date(item.created_at) : new Date(),
    metadata: item.metadata,
    executionId:
      typeof item.metadata?.execution_id === "string" ? item.metadata.execution_id : undefined,
  };
}

function decodeEvent(eventName: string, data: Record<string, unknown>): StreamEvent | null {
  switch (eventName) {
    case "error":
      return { type: "error", error: String(data.message || data.error || "Stream error") };
    case "execution":
      return { type: "execution", executionId: String(data.execution_id || "") };
    case "content":
      return { type: "content", content: String(data.content || "") };
    case "thinking":
      return { type: "thinking", thinking: String(data.content || "") };
    case "tool_start":
      return {
        type: "tool_start",
        toolCallId: String(data.id || ""),
        toolName: String(data.name || ""),
      };
    case "tool_end":
      return {
        type: "tool_end",
        toolCallId: String(data.id || ""),
        toolName: String(data.name || ""),
        toolSummary: String(data.summary || ""),
      };
    case "ui":
      return { type: "ui", ui: data };
    case "done":
    case "complete":
      return { type: "done", output: data.output ?? data.result ?? data };
    default:
      return null;
  }
}

async function* readSSE(response: Response): AsyncGenerator<StreamEvent> {
  if (!response.body) throw new BrowserChatError("Streaming response body is unavailable.", 502);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      for (const block of blocks) {
        const eventName = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
        const raw = block
          .split(/\r?\n/)
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim())
          .join("\n");
        if (!raw) continue;
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          if (eventName === "content") yield { type: "content", content: raw };
          continue;
        }
        const event = decodeEvent(eventName, data);
        if (event) yield event;
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}

export function createBrowserChatRuntime(config: BrowserRuntimeConfig): BrowserChatRuntime {
  if (!config.apiKey) throw new Error("@promptrails/ai-chat: browser apiKey is required.");
  if (!config.agentId) throw new Error("@promptrails/ai-chat: agentId is required.");

  const requestedMaxAge = Number(config.sessionMaxAge);
  const sessionMaxAge =
    Number.isFinite(requestedMaxAge) && requestedMaxAge > 0
      ? Math.min(Math.floor(requestedMaxAge), MAX_SESSION_MAX_AGE_SECONDS)
      : DEFAULT_SESSION_MAX_AGE_SECONDS;
  const apiUrl = `${cleanBase(config.baseUrl || "https://api.promptrails.ai")}/api/v1`;
  const storageKey =
    config.storageKey ||
    `promptrails-chat-widget:${config.workspaceId || "default"}:${config.agentId}`;
  const source = generateId();
  const listeners = new Set<(event: BrowserRuntimeEvent) => void>();

  let sessionId = "";
  let resumeToken = "";
  let accessToken = "";
  let accessTokenExpiresAt = 0;
  let tokenPromise: Promise<string> | null = null;
  let sessionPromise: Promise<string> | null = null;
  let channel: BroadcastChannel | null = null;

  const emit = (event: BrowserRuntimeEvent) => {
    config.onEvent?.(event);
    listeners.forEach((listener) => listener(event));
  };

  function storage(): Storage | null {
    if (config.persistSession === false || typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function snapshot(): BrowserSessionSnapshot | null {
    if (!sessionId || !resumeToken) return null;
    return { sessionId, resumeToken, lastActivityAt: Date.now() };
  }

  function broadcast(type: SessionBroadcast["type"], next?: BrowserSessionSnapshot): void {
    channel?.postMessage({ source, type, snapshot: next } satisfies SessionBroadcast);
  }

  function clearPersistedSession(notify = true): void {
    try {
      storage()?.removeItem(storageKey);
    } catch {
      // Persistence is optional.
    }
    if (notify) broadcast("clear");
  }

  function persist(notify = true): void {
    const next = snapshot();
    if (!next) return;
    try {
      storage()?.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Persistence is optional.
    }
    if (notify) broadcast("session", next);
  }

  function restore(): boolean {
    try {
      const raw = storage()?.getItem(storageKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw) as Partial<BrowserSessionSnapshot> & { chatId?: string };
      const saved = { ...parsed, sessionId: parsed.sessionId || parsed.chatId };
      if (!sessionIsValid(saved, sessionMaxAge * 1000)) {
        clearPersistedSession();
        return false;
      }
      sessionId = String(saved.sessionId);
      resumeToken = String(saved.resumeToken);
      persist();
      return true;
    } catch {
      clearPersistedSession();
      return false;
    }
  }

  if (
    config.coordinateTabs !== false &&
    config.persistSession !== false &&
    typeof BroadcastChannel !== "undefined"
  ) {
    channel = new BroadcastChannel(`${storageKey}:channel`);
    channel.onmessage = (event: MessageEvent<SessionBroadcast>) => {
      const message = event.data;
      if (!message || message.source === source) return;
      if (message.type === "clear") {
        sessionId = "";
        resumeToken = "";
        clearPersistedSession(false);
        emit({ type: "session.cleared" });
      } else if (message.snapshot && sessionIsValid(message.snapshot, sessionMaxAge * 1000)) {
        sessionId = message.snapshot.sessionId;
        resumeToken = message.snapshot.resumeToken;
        persist(false);
        emit({ type: "session.resumed", sessionId });
      }
    };
  }

  async function ensureAccessToken(force = false): Promise<string> {
    if (!force && accessToken && Date.now() < accessTokenExpiresAt - TOKEN_REFRESH_SKEW_MS) {
      return accessToken;
    }
    if (!force && tokenPromise) return tokenPromise;

    tokenPromise = (async () => {
      let response: Response;
      try {
        response = await fetch(`${apiUrl}/browser/chat/token`, {
          method: "POST",
          mode: "cors",
          credentials: "omit",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-API-Key": config.apiKey,
          },
          body: JSON.stringify({ agent_id: config.agentId }),
        });
      } catch (error) {
        throw new BrowserChatError(error instanceof Error ? error.message : "Network error.", 0);
      }
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<{
        access_token?: string;
        expires_in?: number;
      }>;
      if (!response.ok) throw apiError(response.status, payload);
      accessToken = String(payload.data?.access_token || "");
      accessTokenExpiresAt = Date.now() + (Number(payload.data?.expires_in) || 900) * 1000;
      if (!accessToken) throw new BrowserChatError("Temporary chat token was not returned.", 502);
      emit({ type: "token.refreshed", expiresAt: accessTokenExpiresAt });
      return accessToken;
    })();

    try {
      return await tokenPromise;
    } finally {
      tokenPromise = null;
    }
  }

  async function request<T>(
    path: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<ApiEnvelope<T>> {
    const token = await ensureAccessToken();
    let response: Response;
    try {
      response = await fetch(`${apiUrl}${path}`, {
        mode: "cors",
        credentials: "omit",
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(sessionId && resumeToken ? { "X-Chat-Resume-Token": resumeToken } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
      });
    } catch (error) {
      throw new BrowserChatError(error instanceof Error ? error.message : "Network error.", 0);
    }
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
    if (response.status === 401 && retry) {
      await ensureAccessToken(true);
      return request<T>(path, options, false);
    }
    if (!response.ok) throw apiError(response.status, payload);
    return payload;
  }

  async function ensureSession(): Promise<string> {
    if (sessionId && resumeToken) return sessionId;
    if (sessionPromise) return sessionPromise;
    sessionPromise = (async () => {
      const payload = await request<BrowserSessionResponse>("/browser/chat/sessions", {
        method: "POST",
        body: JSON.stringify({
          agent_id: config.agentId,
          title: config.title || "Website chat",
          metadata: config.metadata || { channel: "browser_widget" },
        }),
      });
      sessionId = String(payload.data?.id || payload.data?.session_id || "");
      resumeToken = String(payload.data?.resume_token || "");
      if (!sessionId || !resumeToken) {
        throw new BrowserChatError("Chat session could not be created.", 502);
      }
      persist();
      emit({ type: "session.created", sessionId });
      return sessionId;
    })();
    try {
      return await sessionPromise;
    } finally {
      sessionPromise = null;
    }
  }

  async function openStream(
    message: BrowserRuntimeMessage,
    signal?: AbortSignal,
    forceToken = false,
  ): Promise<Response> {
    const token = await ensureAccessToken(forceToken);
    return fetch(
      `${apiUrl}/browser/chat/sessions/${encodeURIComponent(sessionId)}/messages/stream`,
      {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: {
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "X-Chat-Resume-Token": resumeToken,
        },
        body: JSON.stringify({
          content: message.content,
          ...(message.context ? { client_context: message.context } : {}),
          idempotency_key: message.idempotencyKey,
        }),
        signal,
      },
    );
  }

  const runtime: BrowserChatRuntime = {
    get sessionId() {
      return sessionId;
    },

    async createSession(title?: string): Promise<BrowserSessionResponse> {
      if (sessionId && resumeToken) {
        return { id: sessionId, agent_id: config.agentId, title: title || config.title };
      }
      await ensureSession();
      return { id: sessionId, agent_id: config.agentId, title: title || config.title };
    },

    async hydrate(): Promise<Message[]> {
      if (!restore()) return [];
      try {
        const messages = await runtime.listMessages();
        emit({ type: "session.resumed", sessionId });
        return messages;
      } catch (error) {
        if (error instanceof BrowserChatError && (error.status === 403 || error.status === 404)) {
          sessionId = "";
          resumeToken = "";
          clearPersistedSession();
          emit({ type: "session.cleared" });
          return [];
        }
        throw error;
      }
    },

    async listMessages(): Promise<Message[]> {
      if (!sessionId || !resumeToken) return [];
      const payload = await request<BrowserMessageResponse[]>(
        `/browser/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=50`,
      );
      persist();
      return (Array.isArray(payload.data) ? payload.data : [])
        .map(messageFromApi)
        .filter((message): message is Message => message !== null);
    },

    async *sendMessageStream(message, signal): AsyncGenerator<StreamEvent> {
      await ensureSession();
      const idempotencyKey = message.idempotencyKey || generateId();
      const requestMessage = { ...message, idempotencyKey };
      emit({ type: "message.started", idempotencyKey });
      let executionId: string | undefined;

      try {
        let response: Response;
        try {
          response = await openStream(requestMessage, signal);
        } catch (error) {
          if (signal?.aborted) throw error;
          response = await openStream(requestMessage, signal);
        }
        if (response.status === 401) response = await openStream(requestMessage, signal, true);
        if (!response.ok || !response.body) {
          const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
          throw apiError(response.status, payload);
        }
        persist();
        for await (const event of readSSE(response)) {
          if (event.type === "execution") executionId = event.executionId;
          yield event;
        }
        persist();
        emit({ type: "message.completed", idempotencyKey, executionId });
      } catch (error) {
        const normalized =
          error instanceof BrowserChatError
            ? error
            : new BrowserChatError(error instanceof Error ? error.message : String(error), 0);
        emit({ type: "message.failed", idempotencyKey, error: normalized });
        throw normalized;
      }
    },

    async newSession(): Promise<void> {
      const previousId = sessionId;
      const previousResumeToken = resumeToken;
      sessionId = "";
      resumeToken = "";
      sessionPromise = null;
      clearPersistedSession();
      emit({ type: "session.cleared" });
      if (!previousId || !previousResumeToken) return;
      try {
        const token = await ensureAccessToken();
        await fetch(`${apiUrl}/browser/chat/sessions/${encodeURIComponent(previousId)}`, {
          method: "DELETE",
          mode: "cors",
          credentials: "omit",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Chat-Resume-Token": previousResumeToken,
          },
        });
      } catch {
        // Local reset must not be blocked by best-effort server revocation.
      }
    },

    async submitFeedback(executionId: string, value: 1 | -1): Promise<void> {
      if (!sessionId || !resumeToken) throw new BrowserChatError("No active chat session.", 409);
      await request(`/browser/chat/sessions/${encodeURIComponent(sessionId)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ execution_id: executionId, value }),
      });
      persist();
      emit({ type: "feedback.submitted", executionId, value });
    },

    disconnect(): void {
      accessToken = "";
      accessTokenExpiresAt = 0;
      tokenPromise = null;
      sessionPromise = null;
      channel?.close();
      channel = null;
      listeners.clear();
    },
  };

  return runtime;
}
