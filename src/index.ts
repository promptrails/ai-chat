// Core hooks

// Browser-safe headless runtime
export {
  BrowserChatError,
  type BrowserChatRuntime,
  type BrowserMessageContext,
  type BrowserRuntimeConfig,
  type BrowserRuntimeEvent,
  type BrowserRuntimeMessage,
  type BrowserSessionSnapshot,
  createBrowserChatRuntime,
} from "./browser";
// Components
export {
  AgentSteps,
  ApprovalCard,
  ChatHeader,
  ChatWindow,
  MessageBubble,
  MessageInput,
  ScrollAnchor,
  TypingIndicator,
} from "./components";
export type {
  MessagesAction,
  MessagesState,
  UseAgentReturn,
  UseApprovalReturn,
  UseChatReturn,
  UseStreamingReturn,
} from "./core";
export {
  generateId,
  initialState,
  messagesReducer,
  parseSSEStream,
  retryWithBackoff,
  useAgent,
  useApproval,
  useChat,
  useStreaming,
} from "./core";
export type {
  CartAddDetail,
  ProductViewDetail,
  PromptRailsShopAssistantElement,
  ShopAssistantContext,
  ShopAssistantEventMap,
} from "./ecommerce/types";
export type {
  ChatProvider,
  CustomProviderConfig,
  ExecutionStatusResult,
  OpenAIProviderConfig,
  PromptRailsBrowserProvider,
  PromptRailsBrowserProviderConfig,
  PromptRailsProviderConfig,
  SendMessageParams,
  SendMessageResult,
} from "./providers";

// Providers
export {
  createCustomProvider,
  createOpenAIProvider,
  createPromptRailsBrowserProvider,
  createPromptRailsProvider,
} from "./providers";
// Types
export type {
  AgentStep,
  AgentStepsProps,
  ApprovalCardProps,
  ApprovalDecision,
  ApprovalRequest,
  ChatSession,
  ChatWindowProps,
  ExecutionStatus,
  Message,
  MessageBubbleProps,
  MessageInputProps,
  MessageRole,
  MessageStatus,
  StreamEvent,
  StreamEventType,
  ToolCall,
  TypingIndicatorProps,
  UseAgentOptions,
  UseApprovalOptions,
  UseChatOptions,
  UseStreamingOptions,
  WidgetConfig,
  WidgetController,
  WidgetEvent,
  WidgetLabels,
} from "./types";
export {
  type ChatUIAction,
  type ChatUIRenderer,
  type ChatUIRendererRegistry,
  type ChatUIResource,
  type ChatUISuggestion,
  createChatUIRendererRegistry,
  type NormalizedChatUI,
  normalizeChatUI,
} from "./ui";
