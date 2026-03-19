import type {
  ApprovalDecision,
  ApprovalRequest,
  ChatSession,
  Message,
  StreamEvent,
} from "../types";
import { generateId, parseSSEStream } from "../core/utils";
import type {
  ChatProvider,
  ExecutionStatusResult,
  SendMessageParams,
  SendMessageResult,
} from "./types";

export interface PromptRailsProviderConfig {
  apiKey: string;
  workspaceId: string;
  agentId: string;
  /** Defaults to https://api.promptrails.ai */
  baseUrl?: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export function createPromptRailsProvider(config: PromptRailsProviderConfig): ChatProvider {
  const { apiKey, workspaceId, agentId, baseUrl = "https://api.promptrails.ai" } = config;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
    "X-Workspace-ID": workspaceId,
  };

  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message = `HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.error || parsed.message || message;
      } catch {
        // ignore parse error
      }
      throw new Error(message);
    }

    const json = (await response.json()) as ApiResponse<T>;
    if (json.error) {
      throw new Error(json.error);
    }
    return json.data;
  }

  const provider: ChatProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      const sessionId = params.sessionId;
      if (!sessionId) {
        throw new Error("sessionId is required for PromptRails provider");
      }

      const data = await request<{
        id: string;
        role: string;
        content: string;
        created_at: string;
        execution_id?: string;
      }>("POST", `/api/v1/chat/sessions/${sessionId}/messages`, {
        content: params.content,
        metadata: params.metadata,
      });

      return {
        message: {
          id: data.id,
          role: "assistant",
          content: data.content,
          status: "complete",
          createdAt: new Date(data.created_at),
          executionId: data.execution_id,
        },
        executionId: data.execution_id,
      };
    },

    async *sendMessageStream(
      params: SendMessageParams,
      signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      const sessionId = params.sessionId;
      if (!sessionId) {
        throw new Error("sessionId is required for PromptRails provider");
      }

      const response = await fetch(`${baseUrl}/api/v1/chat/sessions/${sessionId}/messages/stream`, {
        method: "POST",
        headers: {
          ...headers,
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          content: params.content,
          metadata: params.metadata,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      yield* parseSSEStream(response, signal);
    },

    async createSession(_agentId?: string, title?: string): Promise<ChatSession> {
      const data = await request<{
        id: string;
        agent_id: string;
        title: string;
        created_at: string;
      }>("POST", `/api/v1/chat/sessions`, {
        agent_id: agentId,
        title: title || "New Chat",
      });

      return {
        id: data.id,
        agentId: data.agent_id,
        title: data.title,
        createdAt: new Date(data.created_at),
      };
    },

    async listMessages(
      sessionId: string,
      page?: number,
    ): Promise<{ messages: Message[]; total: number }> {
      const data = await request<{
        items: Array<{
          id: string;
          role: string;
          content: string;
          created_at: string;
        }>;
        total: number;
      }>("GET", `/api/v1/chat/sessions/${sessionId}/messages?page=${page ?? 1}`);

      return {
        messages: data.items.map((item) => ({
          id: item.id || generateId(),
          role: item.role as Message["role"],
          content: item.content,
          status: "complete" as const,
          createdAt: new Date(item.created_at),
        })),
        total: data.total,
      };
    },

    async getExecutionStatus(executionId: string): Promise<ExecutionStatusResult> {
      return await request<ExecutionStatusResult>("GET", `/api/v1/executions/${executionId}`);
    },

    async listApprovals(filters?: { status?: string }): Promise<ApprovalRequest[]> {
      const query = filters?.status ? `?status=${filters.status}` : "";
      const data = await request<
        Array<{
          id: string;
          execution_id: string;
          agent_id?: string;
          checkpoint_name: string;
          payload: Record<string, unknown>;
          status: string;
          reason?: string;
          decided_at?: string;
          created_at: string;
        }>
      >("GET", `/api/v1/approvals${query}`);

      return data.map((item) => ({
        id: item.id,
        executionId: item.execution_id,
        agentId: item.agent_id,
        checkpointName: item.checkpoint_name,
        payload: item.payload,
        status: item.status as ApprovalRequest["status"],
        reason: item.reason,
        decidedAt: item.decided_at ? new Date(item.decided_at) : undefined,
        createdAt: new Date(item.created_at),
      }));
    },

    async decideApproval(
      id: string,
      decision: ApprovalDecision,
      reason?: string,
    ): Promise<ApprovalRequest> {
      const data = await request<{
        id: string;
        execution_id: string;
        agent_id?: string;
        checkpoint_name: string;
        payload: Record<string, unknown>;
        status: string;
        reason?: string;
        decided_at?: string;
        created_at: string;
      }>("POST", `/api/v1/approvals/${id}/decide`, {
        decision,
        reason,
      });

      return {
        id: data.id,
        executionId: data.execution_id,
        agentId: data.agent_id,
        checkpointName: data.checkpoint_name,
        payload: data.payload,
        status: data.status as ApprovalRequest["status"],
        reason: data.reason,
        decidedAt: data.decided_at ? new Date(data.decided_at) : undefined,
        createdAt: new Date(data.created_at),
      };
    },
  };

  return provider;
}
