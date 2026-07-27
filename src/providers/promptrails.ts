import {
  type AgentExecution,
  PromptRails,
  type StreamEvent as SdkStreamEvent,
} from "@promptrails/sdk";
import { generateId } from "../core/utils";
import type {
  AgentStep,
  ApprovalDecision,
  ApprovalRequest,
  ExecutionStatus,
  Message,
  StreamEvent,
} from "../types";
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

/**
 * API v2 executions form a tree — sub-agent delegations, handoffs and
 * workflow-node runs hang off the root as `children`. Flatten that tree
 * depth-first into the flat AgentStep[] the useAgent hook renders. Statuses
 * (`waiting_approval`, `cancel_requested`, ...) already match ExecutionStatus.
 */
function flattenExecutionTree(nodes: AgentExecution[]): AgentStep[] {
  const steps: AgentStep[] = [];
  for (const node of nodes) {
    steps.push({
      id: node.id,
      name: node.agent_id,
      status: node.status as ExecutionStatus,
      input: node.input,
      output: node.output,
      durationMs: node.duration_ms,
      error: node.error || undefined,
      startedAt: node.started_at ? new Date(node.started_at) : undefined,
      completedAt: node.completed_at ? new Date(node.completed_at) : undefined,
    });
    if (node.children?.length) {
      steps.push(...flattenExecutionTree(node.children));
    }
  }
  return steps;
}

/**
 * Map a v2 execution parked at (or resumed from) an approval gate into the
 * package's flat ApprovalRequest shape. `status` reflects the local decision
 * model: an inbox entry is "pending"; approve/deny return the resumed
 * execution mapped to "approved"/"rejected".
 */
function toApprovalRequest(
  exec: AgentExecution,
  status: ApprovalRequest["status"],
): ApprovalRequest {
  return {
    id: exec.id,
    executionId: exec.id,
    agentId: exec.agent_id,
    payload: exec.input as Record<string, unknown>,
    status,
    approvalExpiresAt: exec.approval_expires_at ? new Date(exec.approval_expires_at) : undefined,
    createdAt: new Date(exec.created_at),
  };
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
      // v2: fetch the execution tree so sub-agent / workflow-node children
      // surface as steps. The root is the tracked execution; its children are
      // the sub-steps.
      const result = await client.executions.tree(executionId);
      return {
        status: result.status as ExecutionStatusResult["status"],
        output: result.output as Record<string, unknown> | undefined,
        error: result.error || undefined,
        steps: result.children?.length ? flattenExecutionTree(result.children) : undefined,
      };
    },

    async listApprovals(_filters?: { status?: string }): Promise<ApprovalRequest[]> {
      // v2: the approval inbox is the set of executions parked at
      // `waiting_approval`; there is no separate approval status to filter by.
      const result = await client.executions.approvalInbox({ page: 1, limit: 50 });
      return result.data.map((exec) => toApprovalRequest(exec, "pending"));
    },

    async decideApproval(
      id: string,
      decision: ApprovalDecision,
      reason?: string,
    ): Promise<ApprovalRequest> {
      // v2: approving/denying resumes the parked execution itself. `id` is the
      // execution id.
      const exec =
        decision === "approved"
          ? await client.executions.approve(id, reason ? { reason } : undefined)
          : await client.executions.deny(id, reason ? { reason } : undefined);

      return toApprovalRequest(exec, decision === "approved" ? "approved" : "rejected");
    },

    disconnect() {
      sessionId = null;
    },
  };

  return provider;
}
