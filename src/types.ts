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

export type StreamEventType = "content" | "tool_call" | "status" | "error" | "done";

export interface StreamEvent {
  type: StreamEventType;
  content?: string;
  error?: string;
  executionId?: string;
  status?: ExecutionStatus;
  toolCall?: ToolCall;
}

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "awaiting_approval"
  | "rejected";

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

export interface ApprovalRequest {
  id: string;
  executionId: string;
  agentId?: string;
  checkpointName: string;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  reason?: string;
  decidedAt?: Date;
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
}

export interface UseStreamingOptions {
  onChunk?: (chunk: string) => void;
  onComplete?: (fullContent: string) => void;
  onError?: (error: Error) => void;
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
  onError?: (error: Error) => void;
}

export interface MessageBubbleProps {
  message: Message;
  className?: string;
  renderMarkdown?: boolean;
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
    workspaceId?: string;
    model?: string;
    [key: string]: unknown;
  };
  position?: "bottom-right" | "bottom-left";
  title?: string;
  placeholder?: string;
  primaryColor?: string;
  bubbleIcon?: string;
  greeting?: string;
  width?: number;
  height?: number;
  zIndex?: number;
}
