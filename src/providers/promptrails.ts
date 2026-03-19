import { PromptRails } from "@promptrails/sdk";
import type { StreamEvent, Message, ApprovalRequest, ApprovalDecision } from "../types";
import { generateId, parseSSEStream } from "../core/utils";
import type {
  ChatProvider,
  ExecutionStatusResult,
  SendMessageParams,
  SendMessageResult,
} from "./types";

export interface PromptRailsProviderConfig {
  apiKey: string;
  agentId: string;
  /** Defaults to https://api.promptrails.ai */
  baseUrl?: string;
}

export function createPromptRailsProvider(config: PromptRailsProviderConfig): ChatProvider {
  const { apiKey, agentId, baseUrl = "https://api.promptrails.ai" } = config;

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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };

  const provider: ChatProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      const sid = params.sessionId ?? (await ensureSession());

      const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${sid}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content: params.content }),
      });

      if (!response.ok) {
        const body = await response.text();
        let msg = `HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(body);
          msg = parsed.error?.message || parsed.message || msg;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const json = await response.json();
      const data = json.data;
      const assistantMsg = data.assistant_message;

      return {
        message: {
          id: assistantMsg.id,
          role: "assistant",
          content: assistantMsg.content,
          status: "complete",
          createdAt: new Date(assistantMsg.created_at),
        },
        executionId: data.execution_id,
      };
    },

    async *sendMessageStream(
      params: SendMessageParams,
      signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      const sid = params.sessionId ?? (await ensureSession());

      // SDK doesn't support streaming, use fetch directly
      const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${sid}/messages/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          content: params.content,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      yield* parseSSEStream(response, signal);
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
