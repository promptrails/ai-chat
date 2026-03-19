# @promptrails/ai-chat

Embeddable AI chat widget + React hooks for building AI-powered chat interfaces.

Works with **PromptRails**, **OpenAI**, or any custom SSE/WebSocket backend.

## Features

- **React Hooks** — `useChat()`, `useStreaming()`, `useAgent()`, `useApproval()`
- **React Components** — `<ChatWindow />`, `<MessageBubble />`, `<AgentSteps />`, `<ApprovalCard />`
- **Embeddable Widget** — One `<script>` tag, no React needed. Shadow DOM isolation.
- **Multi-Provider** — PromptRails, OpenAI, or any custom backend
- **Agent Step Tracking** — Real-time multi-step execution timeline
- **Human-in-the-Loop** — Built-in approval flow UI
- **Streaming** — SSE and WebSocket support
- **TypeScript** — Full type safety

## Installation

```bash
npm install @promptrails/ai-chat
```

## Quick Start

### 1. Script Tag (No React Needed)

```html
<script
  src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat/dist/widget.global.js"
  data-provider="promptrails"
  data-api-key="pk_your_api_key"
  data-base-url="https://api.example.com"
  data-agent-id="your_agent_id"
  data-workspace-id="your_workspace_id"
  data-title="Support Chat"
  data-greeting="Hi! How can I help you today?"
></script>
```

Or initialize programmatically:

```html
<script src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat/dist/widget.global.js"></script>
<script>
  PromptRailsChat.init({
    provider: {
      type: "openai",
      apiKey: "sk-...",
      model: "gpt-4o-mini",
    },
    title: "AI Assistant",
    position: "bottom-right",
    primaryColor: "#2563eb",
    greeting: "Hi! How can I help?",
  });
</script>
```

Widget API:

```js
PromptRailsChat.open();    // Open the chat panel
PromptRailsChat.close();   // Close the chat panel
PromptRailsChat.toggle();  // Toggle open/close
PromptRailsChat.destroy(); // Remove from DOM
```

### 2. React Component

```tsx
import { ChatWindow, createPromptRailsProvider } from "@promptrails/ai-chat";
import "@promptrails/ai-chat/styles.css";

const provider = createPromptRailsProvider({
  baseUrl: "https://api.example.com",
  apiKey: "pk_your_api_key",
  workspaceId: "your_workspace_id",
  agentId: "your_agent_id",
});

export default function App() {
  return (
    <ChatWindow
      provider={provider}
      title="Support Chat"
      placeholder="Ask anything..."
      showAgentSteps
      showApprovals
    />
  );
}
```

### 3. React Hooks (Build Your Own UI)

```tsx
import { useChat, createOpenAIProvider } from "@promptrails/ai-chat";

const provider = createOpenAIProvider({
  apiKey: "sk-...",
  model: "gpt-4o-mini",
});

export default function CustomChat() {
  const { messages, isLoading, input, setInput, handleSubmit } = useChat({
    provider,
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.role}>
          {msg.content}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
        />
        <button disabled={isLoading}>Send</button>
      </form>
    </div>
  );
}
```

## Providers

### PromptRails

```ts
import { createPromptRailsProvider } from "@promptrails/ai-chat";

const provider = createPromptRailsProvider({
  baseUrl: "https://api.example.com",
  apiKey: "pk_...",
  workspaceId: "ws_...",
  agentId: "agent_...",
});
```

Supports: streaming, sessions, agent execution tracking, approvals.

### OpenAI

```ts
import { createOpenAIProvider } from "@promptrails/ai-chat";

const provider = createOpenAIProvider({
  apiKey: "sk-...",
  model: "gpt-4o-mini", // default
  baseUrl: "https://api.openai.com/v1", // default
});
```

Works with any OpenAI-compatible API (DeepSeek, Together, Groq, etc.).

### Custom

```ts
import { createCustomProvider } from "@promptrails/ai-chat";

const provider = createCustomProvider({
  sendUrl: "https://your-api.com/chat",
  streamUrl: "https://your-api.com/chat/stream", // optional
  transport: "sse", // or "websocket"
  headers: { Authorization: "Bearer ..." },
});
```

## Hooks API

### `useChat(options)`

Main hook for chat functionality.

```ts
const {
  messages,     // Message[]
  isLoading,    // boolean
  error,        // Error | null
  input,        // string — controlled input value
  setInput,     // (value: string) => void
  sendMessage,  // (content: string) => Promise<void>
  handleSubmit, // (e?: FormEvent) => void
  retry,        // (messageId: string) => Promise<void>
  clearMessages,// () => void
  setMessages,  // (messages: Message[]) => void
} = useChat({ provider, sessionId, initialMessages, onError, onFinish });
```

### `useStreaming(options)`

Low-level streaming control.

```ts
const {
  isStreaming,  // boolean
  content,     // string — accumulated content
  error,       // Error | null
  startStream, // (generator: AsyncGenerator<StreamEvent>) => void
  stopStream,  // () => void
} = useStreaming({ onChunk, onComplete, onError });
```

### `useAgent(options)`

Track multi-step agent executions.

```ts
const {
  steps,          // AgentStep[]
  currentStep,    // AgentStep | null
  isRunning,      // boolean
  error,          // Error | null
  trackExecution, // (executionId: string) => void
  cancel,         // () => void
} = useAgent({ provider, onStepUpdate, onComplete, onError, pollIntervalMs });
```

### `useApproval(options)`

Human-in-the-loop approval flow.

```ts
const {
  pendingApprovals, // ApprovalRequest[]
  approve,          // (id: string, reason?: string) => Promise<void>
  reject,           // (id: string, reason?: string) => Promise<void>
  isDeciding,       // boolean
  addApproval,      // (request: ApprovalRequest) => void
} = useApproval({ provider, onApprovalRequired, onApprovalDecided });
```

## Components

| Component | Description |
|-----------|-------------|
| `<ChatWindow />` | Full chat interface with header, messages, input |
| `<MessageBubble />` | Single message bubble with markdown support |
| `<MessageInput />` | Auto-resizing textarea with send button |
| `<TypingIndicator />` | Bouncing dots animation |
| `<AgentSteps />` | Collapsible execution step timeline |
| `<ApprovalCard />` | Approve/reject card with reason input |
| `<ChatHeader />` | Title bar with online indicator |
| `<ScrollAnchor />` | Auto-scroll to newest messages |

Import components individually or from the main entry:

```ts
import { ChatWindow } from "@promptrails/ai-chat";
// or
import { ChatWindow } from "@promptrails/ai-chat/components";
```

## Sub-path Imports

Tree-shake by importing only what you need:

```ts
import { useChat } from "@promptrails/ai-chat/core";
import { ChatWindow } from "@promptrails/ai-chat/components";
import { createOpenAIProvider } from "@promptrails/ai-chat/providers";
```

## Widget Configuration

| Attribute | Description | Default |
|-----------|-------------|---------|
| `data-provider` | `"promptrails"`, `"openai"`, `"custom"` | required |
| `data-api-key` | API key for the provider | — |
| `data-base-url` | Backend API URL | — |
| `data-agent-id` | PromptRails agent ID | — |
| `data-workspace-id` | PromptRails workspace ID | — |
| `data-model` | LLM model name (OpenAI) | `"gpt-4o-mini"` |
| `data-title` | Chat window title | `"Chat"` |
| `data-placeholder` | Input placeholder text | `"Type a message..."` |
| `data-greeting` | Initial greeting message | — |
| `data-position` | `"bottom-right"` or `"bottom-left"` | `"bottom-right"` |
| `data-primary-color` | Hex color for theming | `"#2563eb"` |
| `data-width` | Panel width in pixels | `380` |
| `data-height` | Panel height in pixels | `600` |
| `data-z-index` | CSS z-index | `9999` |

## Development

```bash
npm install        # Install dependencies
npm run build      # Build library + widget
npm test           # Run tests
npm run typecheck  # TypeScript check
npm run lint       # ESLint + Prettier
npm run lint:fix   # Auto-fix lint issues
npm run dev        # Watch mode
```

## License

MIT — [PromptRails](https://promptrails.com)
