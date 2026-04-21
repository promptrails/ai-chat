import { PromptRails, type StreamEvent as SdkStreamEvent } from "@promptrails/sdk";
import type { StreamEvent, Message, ApprovalRequest, ApprovalDecision } from "../types";
import { generateId } from "../core/utils";
import type {
  ChatProvider,
  ExecutionStatusResult,
  SendMessageParams,
  SendMessageResult,
} from "./types";

/**
 * Translate a PromptRails SDK StreamEvent — a discriminated union — into the
 * flat StreamEvent shape this package's consumers expect. The SDK field
 * names differ per kind (id/name/summary on tool frames, message on error,
 * content on thinking), so we can't just re-emit; this adapter is the
 * single place that bridges the two shapes.
 */
function adaptSdkEvent(event: SdkStreamEvent): StreamEvent | null {
  switch (event.type) {
    case "execution":
      return { type: "execution", executionId: event.executionId };
    case "thinking":
      return { type: "thinking", thinking: event.content };
    case "tool_start":
      return { type: "tool_start", toolCallId: event.id, toolName: event.name };
    case "tool_end":
      return {
        type: "tool_end",
        toolCallId: event.id,
        toolName: event.name,
        toolSummary: event.summary,
      };
    case "content":
      return { type: "content", content: event.content };
    case "done":
      return { type: "done", output: event.output };
    case "error":
      return { type: "error", error: event.message };
    default:
      return null;
  }
}

export interface PromptRailsProviderConfig {
  apiKey: string;
  agentId: string;
  /** Defaults to https://api.promptrails.ai */
  baseUrl?: string;
}

export function createPromptRailsProvider(config: PromptRailsProviderConfig): ChatProvider {
  const { apiKey, agentId, baseUrl = "https://api.promptrails.ai" } = config;

  if (!apiKey) throw new Error("@promptrails/ai-chat: apiKey is required.");
  if (!agentId) throw new Error("@promptrails/ai-chat: agentId is required.");

  const client = new PromptRails({ apiKey, baseUrl });

  // Auto-managed session
  let sessionId: string | null = null;

  async function ensureSession(): Promise<string> {
    if (sessionId) return sessionId;
    const session = await client.chat.createSession({
      agent_id: agentId,
      title: "Chat",
    });
    sessionId = session.id;
    return sessionId;
  }

  const provider: ChatProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      // The backend runs chat asynchronously — a non-streaming POST returns the
      // user_message immediately with assistant_message=null and an
      // execution_id. To honour the sendMessage contract (return the final
      // assistant message), consume the SSE stream and collect the output.
      let executionId: string | undefined;
      let content = "";
      let errored: string | undefined;

      for await (const event of provider.sendMessageStream(params)) {
        if (event.type === "execution" && event.executionId) {
          executionId = event.executionId;
        } else if (event.type === "content" && event.content) {
          content += event.content;
        } else if (event.type === "error") {
          errored = event.error ?? "stream error";
          break;
        } else if (event.type === "done") {
          if (!content && event.output) {
            const out = event.output as { content?: unknown };
            if (typeof out.content === "string") {
              content = out.content;
            }
          }
          break;
        }
      }

      if (errored) {
        throw new Error(errored);
      }

      return {
        message: {
          id: generateId(),
          role: "assistant",
          content,
          status: "complete",
          createdAt: new Date(),
        },
        executionId,
      };
    },

    async *sendMessageStream(
      params: SendMessageParams,
      signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      const sid = params.sessionId ?? (await ensureSession());

      for await (const event of client.chat.sendMessageStream(
        sid,
        { content: params.content },
        { signal },
      )) {
        const adapted = adaptSdkEvent(event);
        if (adapted) yield adapted;
      }
    },

    async createSession(_agentId?: string, title?: string) {
      const session = await client.chat.createSession({
        agent_id: agentId,
        title: title || "Chat",
      });
      sessionId = session.id;
      return {
        id: session.id,
        agentId: session.agent_id,
        title: session.title,
        createdAt: new Date(session.created_at),
      };
    },

    async listMessages(sid: string, page?: number) {
      const result = await client.chat.listMessages(sid, {
        page: page ?? 1,
        limit: 50,
      });

      return {
        messages: result.data.map(
          (item): Message => ({
            id: item.id || generateId(),
            role: item.role as Message["role"],
            content: item.content,
            status: "complete",
            createdAt: new Date(item.created_at),
          }),
        ),
        total: result.meta.total,
      };
    },

    async getExecutionStatus(executionId: string): Promise<ExecutionStatusResult> {
      const result = await client.executions.get(executionId);
      return {
        status: result.status as ExecutionStatusResult["status"],
        output: result.output as Record<string, unknown> | undefined,
        error: result.error || undefined,
      };
    },

    async listApprovals(filters?: { status?: string }): Promise<ApprovalRequest[]> {
      const result = await client.approvals.list({
        page: 1,
        limit: 50,
        ...(filters?.status ? { status: filters.status } : {}),
      });

      return result.data.map(
        (item): ApprovalRequest => ({
          id: item.id,
          executionId: item.execution_id,
          agentId: item.agent_id,
          checkpointName: item.checkpoint_name,
          payload: item.payload as Record<string, unknown>,
          status: item.status as ApprovalRequest["status"],
          reason: item.reason,
          decidedAt: item.decided_at ? new Date(item.decided_at) : undefined,
          createdAt: new Date(item.created_at),
        }),
      );
    },

    async decideApproval(
      id: string,
      decision: ApprovalDecision,
      reason?: string,
    ): Promise<ApprovalRequest> {
      const data = await client.approvals.decide(id, {
        decision,
        reason,
      });

      return {
        id: data.id,
        executionId: data.execution_id,
        agentId: data.agent_id,
        checkpointName: data.checkpoint_name,
        payload: data.payload as Record<string, unknown>,
        status: data.status as ApprovalRequest["status"],
        reason: data.reason,
        decidedAt: data.decided_at ? new Date(data.decided_at) : undefined,
        createdAt: new Date(data.created_at),
      };
    },

    disconnect() {
      sessionId = null;
    },
  };

  return provider;
}
