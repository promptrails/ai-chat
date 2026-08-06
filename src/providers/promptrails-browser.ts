import { generateId } from "../core/utils";
import type { ChatSession, Message, StreamEvent } from "../types";
import type { ChatProvider, SendMessageParams, SendMessageResult } from "./types";

const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
const MAX_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface BrowserSessionRecord {
  sessionId: string;
  resumeToken: string;
  lastActivityAt: number;
}

interface ApiEnvelope<T> {
  data?: T;
  error?: string | { message?: string };
  message?: string;
}

interface BrowserSessionResponse {
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

export interface PromptRailsBrowserProviderConfig {
  /** Browser-only API key restricted to chat:write, one agent and exact origins. */
  apiKey: string;
  agentId: string;
  /** Defaults to https://api.promptrails.ai. */
  baseUrl?: string;
  /** Only namespaces browser storage; it is not sent as authorization. */
  workspaceId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  /** Persist the resumable chat reference in localStorage. Defaults to true. */
  persistSession?: boolean;
  /** Local inactivity lifetime in seconds. Defaults to 24 hours, capped at 30 days. */
  sessionMaxAge?: number;
}

export interface PromptRailsBrowserProvider extends ChatProvider {
  /** Restore the persisted session after verifying its resume secret with the API. */
  hydrate(): Promise<Message[]>;
  /** Revoke the current resumable session and clear local state. */
  newSession(): Promise<void>;
  /** Submit thumbs-up (1) or thumbs-down (-1) feedback for an execution. */
  submitFeedback(executionId: string, value: 1 | -1): Promise<void>;
}

class BrowserChatError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "BrowserChatError";
  }
}

function cleanBase(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function finalContent(output: unknown): string {
  let value = output;
  if (value && typeof value === "object" && "content" in value) {
    value = (value as { content?: unknown }).content;
  }
  if (value && typeof value === "object" && "output" in value) {
    value = (value as { output?: unknown }).output;
  }
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "answer", "text"]) {
      if (typeof record[key] === "string") return record[key];
    }
  }
  return "";
}

function messageFromApi(item: BrowserMessageResponse): Message | null {
  if (item.role !== "user" && item.role !== "assistant" && item.role !== "system") return null;
  return {
    id: item.id || generateId(),
    role: item.role,
    content: typeof item.content === "string" ? item.content : "",
    status: "complete",
    createdAt: item.created_at ? new Date(item.created_at) : new Date(),
    executionId:
      typeof item.metadata?.execution_id === "string" ? item.metadata.execution_id : undefined,
  };
}

export function createPromptRailsBrowserProvider(
  config: PromptRailsBrowserProviderConfig,
): PromptRailsBrowserProvider {
  const {
    apiKey,
    agentId,
    baseUrl = "https://api.promptrails.ai",
    workspaceId = "default",
    title = "Website chat",
    metadata = { channel: "browser_widget" },
    persistSession = true,
  } = config;

  if (!apiKey) throw new Error("@promptrails/ai-chat: browser apiKey is required.");
  if (!agentId) throw new Error("@promptrails/ai-chat: agentId is required.");

  const requestedMaxAge = Number(config.sessionMaxAge);
  const sessionMaxAge =
    Number.isFinite(requestedMaxAge) && requestedMaxAge > 0
      ? Math.min(Math.floor(requestedMaxAge), MAX_SESSION_MAX_AGE_SECONDS)
      : DEFAULT_SESSION_MAX_AGE_SECONDS;
  const apiUrl = `${cleanBase(baseUrl)}/api/v1`;
  const storageKey = `promptrails-chat-widget:${workspaceId}:${agentId}`;

  let sessionId = "";
  let resumeToken = "";
  let accessToken = "";
  let accessTokenExpiresAt = 0;

  function storage(): Storage | null {
    if (!persistSession || typeof window === "undefined") return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  function clearPersistedSession(): void {
    try {
      storage()?.removeItem(storageKey);
    } catch {
      // Browser storage is optional.
    }
  }

  function persist(): void {
    if (!sessionId || !resumeToken) return;
    try {
      storage()?.setItem(
        storageKey,
        JSON.stringify({ sessionId, resumeToken, lastActivityAt: Date.now() }),
      );
    } catch {
      // Browser storage is optional.
    }
  }

  function restore(): boolean {
    try {
      const raw = storage()?.getItem(storageKey);
      if (!raw) return false;
      const saved = JSON.parse(raw) as Partial<BrowserSessionRecord>;
      const age = Date.now() - Number(saved.lastActivityAt);
      const valid =
        typeof saved.sessionId === "string" &&
        /^[0-9A-Za-z]{27}$/.test(saved.sessionId) &&
        typeof saved.resumeToken === "string" &&
        saved.resumeToken.length >= 32 &&
        Number.isFinite(age) &&
        age >= 0 &&
        age <= sessionMaxAge * 1000;
      if (!valid) {
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

  function apiError(status: number, payload: ApiEnvelope<unknown>): BrowserChatError {
    const detail =
      typeof payload.error === "string"
        ? payload.error
        : payload.error?.message || payload.message || `Request failed (${status}).`;
    return new BrowserChatError(detail, status);
  }

  async function ensureAccessToken(force = false): Promise<string> {
    if (!force && accessToken && Date.now() < accessTokenExpiresAt - 30_000) return accessToken;
    const response = await fetch(`${apiUrl}/browser/chat/token`, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ agent_id: agentId }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<{
      access_token?: string;
      expires_in?: number;
    }>;
    if (!response.ok) throw apiError(response.status, payload);
    accessToken = String(payload.data?.access_token || "");
    accessTokenExpiresAt = Date.now() + (Number(payload.data?.expires_in) || 900) * 1000;
    if (!accessToken) throw new BrowserChatError("Temporary chat token was not returned.", 502);
    return accessToken;
  }

  async function request<T>(
    path: string,
    options: RequestInit = {},
    retry = true,
  ): Promise<ApiEnvelope<T>> {
    const token = await ensureAccessToken();
    const response = await fetch(`${apiUrl}${path}`, {
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
    const payload = await request<BrowserSessionResponse>("/browser/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ agent_id: agentId, title, metadata }),
    });
    sessionId = String(payload.data?.id || payload.data?.session_id || "");
    resumeToken = String(payload.data?.resume_token || "");
    if (!sessionId || !resumeToken) {
      throw new BrowserChatError("Chat session could not be created.", 502);
    }
    persist();
    return sessionId;
  }

  async function* streamOnce(content: string, signal?: AbortSignal): AsyncGenerator<StreamEvent> {
    await ensureSession();
    const send = async (forceToken = false) => {
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
          body: JSON.stringify({ content }),
          signal,
        },
      );
    };

    let response = await send();
    if (response.status === 401) response = await send(true);
    if (!response.ok || !response.body) {
      const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<unknown>;
      throw apiError(response.status, payload);
    }

    persist();
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
        const data = JSON.parse(raw) as Record<string, unknown>;
        if (eventName === "error") {
          yield { type: "error", error: String(data.message || data.error || "Stream error") };
        } else if (eventName === "execution") {
          yield { type: "execution", executionId: String(data.execution_id || "") };
        } else if (eventName === "content") {
          yield { type: "content", content: String(data.content || "") };
        } else if (eventName === "thinking") {
          yield { type: "thinking", thinking: String(data.content || "") };
        } else if (eventName === "tool_start") {
          yield {
            type: "tool_start",
            toolCallId: String(data.id || ""),
            toolName: String(data.name || ""),
          };
        } else if (eventName === "tool_end") {
          yield {
            type: "tool_end",
            toolCallId: String(data.id || ""),
            toolName: String(data.name || ""),
            toolSummary: String(data.summary || ""),
          };
        } else if (eventName === "done" || eventName === "complete") {
          yield { type: "done", output: data.output ?? data.result ?? data };
        }
      }
      if (done) break;
    }
    persist();
  }

  const provider: PromptRailsBrowserProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      let content = "";
      let executionId: string | undefined;
      for await (const event of provider.sendMessageStream(params)) {
        if (event.type === "content" && event.content) content += event.content;
        if (event.type === "execution") executionId = event.executionId;
        if (event.type === "error") throw new Error(event.error || "Stream error");
        if (event.type === "done" && !content) content = finalContent(event.output);
      }
      return {
        message: {
          id: generateId(),
          role: "assistant",
          content,
          status: "complete",
          createdAt: new Date(),
          executionId,
        },
        executionId,
      };
    },

    async *sendMessageStream(params, signal) {
      try {
        yield* streamOnce(params.content, signal);
      } catch (error) {
        if (!(error instanceof BrowserChatError) || error.status !== 403) throw error;
        sessionId = "";
        resumeToken = "";
        clearPersistedSession();
        yield* streamOnce(params.content, signal);
      }
    },

    async createSession(_agentId?: string, nextTitle?: string): Promise<ChatSession> {
      await provider.newSession();
      const payload = await request<BrowserSessionResponse>("/browser/chat/sessions", {
        method: "POST",
        body: JSON.stringify({ agent_id: agentId, title: nextTitle || title, metadata }),
      });
      sessionId = String(payload.data?.id || payload.data?.session_id || "");
      resumeToken = String(payload.data?.resume_token || "");
      if (!sessionId || !resumeToken)
        throw new BrowserChatError("Chat session could not be created.", 502);
      persist();
      return {
        id: sessionId,
        agentId: String(payload.data?.agent_id || agentId),
        title: payload.data?.title || nextTitle || title,
        createdAt: payload.data?.created_at ? new Date(payload.data.created_at) : new Date(),
      };
    },

    async listMessages(): Promise<{ messages: Message[]; total: number }> {
      if (!sessionId || !resumeToken) return { messages: [], total: 0 };
      const payload = await request<BrowserMessageResponse[]>(
        `/browser/chat/sessions/${encodeURIComponent(sessionId)}/messages?limit=50`,
      );
      const messages = (Array.isArray(payload.data) ? payload.data : [])
        .map(messageFromApi)
        .filter((message): message is Message => message !== null);
      persist();
      return { messages, total: messages.length };
    },

    async hydrate(): Promise<Message[]> {
      if (!restore()) return [];
      try {
        return (await provider.listMessages!(sessionId)).messages;
      } catch (error) {
        if (error instanceof BrowserChatError && (error.status === 403 || error.status === 404)) {
          sessionId = "";
          resumeToken = "";
          clearPersistedSession();
          return [];
        }
        throw error;
      }
    },

    async newSession(): Promise<void> {
      const previousId = sessionId;
      const previousResumeToken = resumeToken;
      sessionId = "";
      resumeToken = "";
      clearPersistedSession();
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
        // Local session reset must not be blocked by best-effort revocation.
      }
    },

    async submitFeedback(executionId: string, value: 1 | -1): Promise<void> {
      if (!sessionId || !resumeToken) throw new BrowserChatError("No active chat session.", 409);
      await request(`/browser/chat/sessions/${encodeURIComponent(sessionId)}/feedback`, {
        method: "POST",
        body: JSON.stringify({ execution_id: executionId, value }),
      });
      persist();
    },

    disconnect() {
      accessToken = "";
      accessTokenExpiresAt = 0;
    },
  };

  return provider;
}
