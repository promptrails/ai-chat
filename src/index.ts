// Core hooks
export { useChat, useStreaming, useAgent, useApproval } from "./core";
export type { UseChatReturn, UseStreamingReturn, UseAgentReturn, UseApprovalReturn } from "./core";

// Utilities
export { generateId, parseSSEStream, retryWithBackoff } from "./core";
export { messagesReducer, initialState } from "./core";
export type { MessagesState, MessagesAction } from "./core";

// Browser-safe headless runtime
export {
  BrowserChatError,
  createBrowserChatRuntime,
  type BrowserChatRuntime,
  type BrowserMessageContext,
  type BrowserRuntimeConfig,
  type BrowserRuntimeEvent,
  type BrowserRuntimeMessage,
  type BrowserSessionSnapshot,
} from "./browser";
export {
  createChatUIRendererRegistry,
  normalizeChatUI,
  type ChatUIAction,
  type ChatUIRenderer,
  type ChatUIRendererRegistry,
  type ChatUIResource,
  type ChatUISuggestion,
  type NormalizedChatUI,
} from "./ui";
export type {
  CartAddDetail,
  ProductViewDetail,
  PromptRailsShopAssistantElement,
  ShopAssistantContext,
  ShopAssistantEventMap,
} from "./ecommerce/types";

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
export {
  createPromptRailsProvider,
  createPromptRailsBrowserProvider,
  createOpenAIProvider,
  createCustomProvider,
} from "./providers";
export type {
  ChatProvider,
  SendMessageParams,
  SendMessageResult,
  ExecutionStatusResult,
  PromptRailsProviderConfig,
  PromptRailsBrowserProvider,
  PromptRailsBrowserProviderConfig,
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
  WidgetController,
  WidgetEvent,
  WidgetLabels,
} from "./types";
