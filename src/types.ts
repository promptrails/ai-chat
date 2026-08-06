import type { ChatProvider } from "./providers/types";

// === Message Types ===

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "streaming" | "complete" | "error";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: Date;
  metadata?: Record<string, unknown>;
  executionId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  status: "pending" | "running" | "complete" | "error";
}

// === Streaming Types ===

export type StreamEventType =
  | "content"
  | "tool_call"
  | "tool_start"
  | "tool_end"
  | "thinking"
  | "execution"
  | "status"
  | "error"
  | "done";

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  error?: string;
  executionId?: string;
  status?: ExecutionStatus;
  toolCall?: ToolCall;
  /** tool_start / tool_end payload */
  toolCallId?: string;
  toolName?: string;
  /** tool_end result summary (short string) */
  toolSummary?: string;
  /** thinking payload — intermediate reasoning text between tool rounds */
  thinking?: string;
  /** done payload — final output produced by the execution */
  output?: unknown;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  // API v2: parked at an approval-gated tool call, resumes on approve/deny.
  | "waiting_approval"
  // API v2: cooperative cancel observed, run winding down before finalizing.
  | "cancel_requested";

// === Agent Step Types ===

export interface AgentStep {
  id: string;
  name: string;
  status: ExecutionStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// === Approval Types ===

export type ApprovalDecision = "approved" | "rejected";

/**
 * API v2 approvals are execution-scoped: a run parked at an approval-gated
 * tool call surfaces with `status: "pending"` (the underlying execution is
 * `waiting_approval`) and, when the backend enforces a deadline,
 * `approvalExpiresAt`. `id` and `executionId` are the same execution id —
 * approving/denying resumes that execution. Who may decide is governed by the
 * agent's approval policy on the server, not carried on the request.
 */
export interface ApprovalRequest {
  id: string;
  executionId: string;
  agentId?: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  approvalExpiresAt?: Date;
  createdAt: Date;
}

// === Session Types ===

export interface ChatSession {
  id: string;
  agentId: string;
  title?: string;
  createdAt: Date;
}

// === Hook Option Types ===

export interface UseChatOptions {
  provider: ChatProvider;
  initialMessages?: Message[];
  sessionId?: string;
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
  maxRetries?: number;
  /**
   * When true (default) the hook uses provider.sendMessageStream and
   * incrementally updates the assistant message — content deltas append to
   * `message.content`, tool calls are aggregated into `message.toolCalls`.
   * Set to false to fall back to the non-streaming provider.sendMessage.
   */
  stream?: boolean;
}

export interface UseStreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
  /** Called when a tool starts executing (status: "running"). */
  onToolStart?: (toolCall: ToolCall) => void;
  /** Called when a tool finishes (status: "complete"). The toolCall carries the summary in `result`. */
  onToolEnd?: (toolCall: ToolCall) => void;
  /** Called with intermediate reasoning text between tool rounds. */
  onThinking?: (content: string) => void;
}

export interface UseAgentOptions {
  provider: ChatProvider;
  onStepUpdate?: (step: AgentStep) => void;
  onComplete?: (steps: AgentStep[]) => void;
  onError?: (error: Error) => void;
  pollIntervalMs?: number;
}

export interface UseApprovalOptions {
  provider: ChatProvider;
  onApprovalRequired?: (request: ApprovalRequest) => void;
  onApprovalDecided?: (request: ApprovalRequest) => void;
}

// === Component Props ===

export interface ChatWindowProps {
  provider: ChatProvider;
  sessionId?: string;
  initialMessages?: Message[];
  title?: string;
  placeholder?: string;
  className?: string;
  showAgentSteps?: boolean;
  showApprovals?: boolean;
  /**
   * Render tool call cards in assistant messages.
   * Stream events still flow through the data layer regardless — this only
   * controls whether the UI shows them. Defaults to true.
   */
  showToolCalls?: boolean;
  onError?: (error: Error) => void;
}

export interface MessageBubbleProps {
  message: Message;
  className?: string;
  renderMarkdown?: boolean;
  /** Render tool call cards on this message. Defaults to true. */
  showToolCalls?: boolean;
}

export interface TypingIndicatorProps {
  className?: string;
  text?: string;
}

export interface AgentStepsProps {
  steps: AgentStep[];
  className?: string;
  collapsible?: boolean;
}

export interface ApprovalCardProps {
  request: ApprovalRequest;
  onApprove: (id: string, reason?: string) => void;
  onReject: (id: string, reason?: string) => void;
  className?: string;
  disabled?: boolean;
}

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

// === Widget Config ===

export interface WidgetConfig {
  provider: {
    type: "promptrails" | "openai" | "custom";
    apiKey?: string;
    baseUrl?: string;
    agentId?: string;
    model?: string;
    [key: string]: unknown;
  };
  position?: "bottom-right" | "bottom-left";
  title?: string;
  placeholder?: string;
  primaryColor?: string;
  workspaceId?: string;
  /** Persist only the resumable chat reference. Defaults to true. */
  persistSession?: boolean;
  /** Local inactivity lifetime in seconds. Defaults to 24 hours. */
  sessionMaxAge?: number;
  /** Optional stylesheet loaded inside the widget's ShadowRoot. */
  stylesheetUrl?: string;
  newSessionLabel?: string;
  feedbackLabel?: string;
  errorMessage?: string;
  bubbleIcon?: string;
  greeting?: string;
  width?: number;
  height?: number;
  zIndex?: number;
}
