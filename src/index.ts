// Core hooks
export { useChat, useStreaming, useAgent, useApproval } from "./core";
export type { UseChatReturn, UseStreamingReturn, UseAgentReturn, UseApprovalReturn } from "./core";

// Utilities
export { generateId, parseSSEStream, retryWithBackoff } from "./core";
export { messagesReducer, initialState } from "./core";
export type { MessagesState, MessagesAction } from "./core";

// Components
export {
  ChatWindow,
  MessageBubble,
  MessageInput,
  TypingIndicator,
  AgentSteps,
  ApprovalCard,
  ChatHeader,
  ScrollAnchor,
} from "./components";

// Providers
export { createPromptRailsProvider, createOpenAIProvider, createCustomProvider } from "./providers";
export type {
  ChatProvider,
  SendMessageParams,
  SendMessageResult,
  ExecutionStatusResult,
  PromptRailsProviderConfig,
  OpenAIProviderConfig,
  CustomProviderConfig,
} from "./providers";

// Types
export type {
  Message,
  MessageRole,
  MessageStatus,
  ToolCall,
  StreamEvent,
  StreamEventType,
  ExecutionStatus,
  AgentStep,
  ApprovalDecision,
  ApprovalRequest,
  ChatSession,
  UseChatOptions,
  UseStreamingOptions,
  UseAgentOptions,
  UseApprovalOptions,
  ChatWindowProps,
  MessageBubbleProps,
  TypingIndicatorProps,
  AgentStepsProps,
  ApprovalCardProps,
  MessageInputProps,
  WidgetConfig,
} from "./types";
