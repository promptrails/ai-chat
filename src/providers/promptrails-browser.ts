import {
  BrowserChatError,
  createBrowserChatRuntime,
  type BrowserRuntimeEvent,
} from "../browser/runtime";
import { generateId } from "../core/utils";
import type { ChatSession, Message } from "../types";
import type { ChatProvider, SendMessageParams, SendMessageResult } from "./types";

export interface PromptRailsBrowserProviderConfig {
  /** Browser-only API key restricted to chat:write, allowed agents, and exact origins. */
  apiKey: string;
  agentId: string;
  baseUrl?: string;
  workspaceId?: string;
  title?: string;
  metadata?: Record<string, unknown>;
  persistSession?: boolean;
  sessionMaxAge?: number;
  coordinateTabs?: boolean;
  onEvent?: (event: BrowserRuntimeEvent) => void;
}

export interface PromptRailsBrowserProvider extends ChatProvider {
  hydrate(): Promise<Message[]>;
  newSession(): Promise<void>;
  submitFeedback(executionId: string, value: 1 | -1): Promise<void>;
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

export function createPromptRailsBrowserProvider(
  config: PromptRailsBrowserProviderConfig,
): PromptRailsBrowserProvider {
  const runtime = createBrowserChatRuntime(config);

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
        yield* runtime.sendMessageStream(
          {
            content: params.content,
            context: params.context,
            idempotencyKey: params.idempotencyKey,
          },
          signal,
        );
      } catch (error) {
        if (!(error instanceof BrowserChatError) || error.status !== 403) throw error;
        await runtime.newSession();
        yield* runtime.sendMessageStream(
          {
            content: params.content,
            context: params.context,
            idempotencyKey: params.idempotencyKey,
          },
          signal,
        );
      }
    },

    async createSession(_agentId?: string, title?: string): Promise<ChatSession> {
      await runtime.newSession();
      const session = await runtime.createSession(title);
      return {
        id: runtime.sessionId,
        agentId: session.agent_id || config.agentId,
        title: session.title || title || config.title,
        createdAt: session.created_at ? new Date(session.created_at) : new Date(),
      };
    },

    async listMessages(): Promise<{ messages: Message[]; total: number }> {
      const messages = await runtime.listMessages();
      return { messages, total: messages.length };
    },

    hydrate: () => runtime.hydrate(),
    newSession: () => runtime.newSession(),
    submitFeedback: (executionId, value) => runtime.submitFeedback(executionId, value),
    disconnect: () => runtime.disconnect(),
  };

  return provider;
}
