import type {
  ApprovalDecision,
  ApprovalRequest,
  ChatSession,
  ExecutionStatus,
  AgentStep,
  Message,
  StreamEvent,
} from "../types";

export interface SendMessageParams {
  content: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  message: Message;
  executionId?: string;
}

export interface ExecutionStatusResult {
  status: ExecutionStatus;
  output?: Record<string, unknown>;
  error?: string;
  steps?: AgentStep[];
}

export interface ChatProvider {
  /** Send a message and get a response (non-streaming). */
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;

  /** Send a message with streaming response. */
  sendMessageStream(params: SendMessageParams, signal?: AbortSignal): AsyncGenerator<StreamEvent>;

  /** Create a new chat session. */
  createSession?(agentId: string, title?: string): Promise<ChatSession>;

  /** List messages in a session. */
  listMessages?(sessionId: string, page?: number): Promise<{ messages: Message[]; total: number }>;

  /** Get execution status for agent tracking. */
  getExecutionStatus?(executionId: string): Promise<ExecutionStatusResult>;

  /** List pending approval requests. */
  listApprovals?(filters?: { status?: string }): Promise<ApprovalRequest[]>;

  /** Decide on an approval request. */
  decideApproval?(
    id: string,
    decision: ApprovalDecision,
    reason?: string,
  ): Promise<ApprovalRequest>;

  /** Cleanup resources. */
  disconnect?(): void;
}
