# @promptrails/ai-chat

Embeddable AI chat widget + React hooks for building AI-powered chat interfaces.

Works with **PromptRails**, **OpenAI**, or any custom SSE/WebSocket backend.

## Features

- **React Hooks** — `useChat()`, `useStreaming()`, `useAgent()`, `useApproval()`
- **React Components** — `<ChatWindow />`, `<MessageBubble />`, `<AgentSteps />`, `<ApprovalCard />`
- **Embeddable Widget** — One `<script>` tag, no React needed. Shadow DOM isolation.
- **Ecommerce Widget** — Browser-safe PromptRails sessions, product cards, persistence, feedback, and host events.
- **Customer-safe tool activity** — Localized progress during catalog, knowledge, order, or custom tool calls without exposing arguments or results.
- **Multi-Provider** — PromptRails, OpenAI, or any custom backend
- **Agent Step Tracking** — Real-time multi-step execution timeline
- **Human-in-the-Loop** — Built-in approval flow UI
- **Streaming** — SSE and WebSocket support
- **TypeScript** — Full type safety

## Documentation

- [Live documentation and demos](https://promptrails.github.io/ai-chat/#demo)
- [Architecture and security model](docs/architecture.md)
- [API reference](docs/api-reference.md)
- [Generic browser widget](docs/browser-widget.md)
- [Ecommerce widget](docs/ecommerce-widget.md)
- [Migrating to v0.8](docs/migration-v0.8.md)
- [Migrating to v0.6](docs/migration-v0.6.md)

## Installation

```bash
npm install @promptrails/ai-chat
```

The PromptRails provider targets **PromptRails API v2** and uses the published
`@promptrails/sdk` package. Browser widgets use the separate browser-safe chat
runtime described below; never expose a provider credential or management API
key in a storefront.

## Quick Start

### 1. Script Tag (No React Needed)

```html
<script
  src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat@0.8.0/dist/widget.global.js"
  data-provider="promptrails"
  data-base-url="https://api.promptrails.ai"
  data-api-key="BROWSER_ONLY_CHAT_KEY"
  data-agent-id="AGENT_KSUID"
  data-workspace-id="WORKSPACE_KSUID"
  data-title="Support Chat"
  data-greeting="Hi! How can I help you today?"
  data-persist-session="true"
  data-session-max-age="86400"
></script>
```

Or initialize programmatically:

```html
<script src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat@0.8.0/dist/widget.global.js"></script>
<script>
  PromptRailsChat.init({
    provider: {
      type: "promptrails",
      apiKey: "BROWSER_ONLY_CHAT_KEY",
      agentId: "AGENT_KSUID",
      baseUrl: "https://api.promptrails.ai",
    },
    workspaceId: "WORKSPACE_KSUID",
    title: "AI Assistant",
    position: "bottom-right",
    primaryColor: "#2563eb",
    greeting: "Hi! How can I help?",
    persistSession: true,
    sessionMaxAge: 86400,
  });
</script>
```

The generic widget and ecommerce widget use the same browser-safe runtime. The
generic bundle renders text chat; the ecommerce bundle additionally understands
the allowlisted product UI contract and emits storefront events. Both refresh
the 15-minute runtime bearer automatically, verify persisted history with a
session resume secret, expose a new-session action, and support thumbs up/down
feedback. See [the generic browser widget guide](docs/browser-widget.md).

Widget API:

```js
PromptRailsChat.open();    // Open the chat panel
PromptRailsChat.close();   // Close the chat panel
PromptRailsChat.toggle();  // Toggle open/close
await PromptRailsChat.send("Track my order");
await PromptRailsChat.newSession();
PromptRailsChat.updateContext({ accountTier: "gold" });
PromptRailsChat.destroy(); // Remove from DOM
```

### Ecommerce storefront widget

The ecommerce bundle is a lightweight vanilla Web Component. It does not ship
React and talks directly to PromptRails' public browser chat runtime:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat@0.8.0/dist/ecommerce.global.js"
  defer
></script>

<promptrails-shop-assistant
  api-url="https://api.promptrails.ai"
  workspace-id="WORKSPACE_KSUID"
  agent-id="AGENT_KSUID"
  api-key="BROWSER_ONLY_CHAT_KEY"
  catalog-url="/api/catalog"
  brand="Acme"
  assistant-name="Acme Alışveriş Asistanı"
  assistant-mark="A"
  persist-session="true"
  session-max-age="86400"
  legal-notice="Devam ederek kişisel veri politikasını kabul edersiniz."
  legal-url="https://shop.example.com/privacy"
  legal-accept-label="Kabul et"
  legal-consent-version="2026-08"
  legal-consent-max-age="180"
  ai-disclaimer="Yanıtlar yapay zekâ tarafından oluşturulur ve hata içerebilir."
  allowed-action-origins='["https://api.whatsapp.com"]'
></promptrails-shop-assistant>
```

The publishable key must have exactly `chat:write`, an agent allowlist, exact
browser origins, and `browser_only=true`. The widget exchanges it for a
15-minute memory-only bearer, refreshes automatically, and resumes only one
session with an origin/key-bound resume secret. Persisted history does not need
a general `read` permission on the public key: listing messages requires both
the short-lived token and that session's resume capability. See
[the ecommerce widget guide](docs/ecommerce-widget.md) for theming, events,
catalog shape, and security boundaries.

When the agent's read-only commerce tool already returns complete product
records, set `product-source="response"` and omit `catalog-url`. This explicit
mode sanitizes an allowlist of card fields from structured output and avoids a
duplicate browser catalog request. The host must still validate emitted product
URLs against its own storefront origin before navigating.

Standalone links use a separate, explicit boundary. The ecommerce widget only
turns a declarative `resource.open` action or a URL in assistant text into a CTA
when its exact origin appears in `allowed-action-origins` (same-origin links are
allowed automatically). Other URLs remain inert text.

When both `legal-notice` and `legal-url` are set, the message composer remains
locked until the visitor explicitly accepts the notice. Acceptance is scoped to
the workspace, agent, and `legal-consent-version`, then persisted in
localStorage with a SameSite cookie fallback. Increment the version whenever
the legal text changes to request consent again.

For bundled apps, import `@promptrails/ai-chat/ecommerce` to register the Web
Component or use the typed `ShopAssistant` adapter from
`@promptrails/ai-chat/ecommerce/react`.

### 2. React Component

```tsx
import { ChatWindow, createPromptRailsBrowserProvider } from "@promptrails/ai-chat";
import "@promptrails/ai-chat/styles.css";

const provider = createPromptRailsBrowserProvider({
  apiKey: "BROWSER_ONLY_CHAT_KEY",
  agentId: "AGENT_KSUID",
  workspaceId: "WORKSPACE_KSUID",
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
import { useChat, createCustomProvider } from "@promptrails/ai-chat";

const provider = createCustomProvider({
  sendUrl: "/api/chat",
  streamUrl: "/api/chat/stream",
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
  apiKey: "pr_...",
  agentId: "your_agent_id",
});
```

Supports: streaming, sessions, agent execution tracking, approvals.

`createPromptRailsProvider` uses the full PromptRails SDK and belongs in trusted
server code or applications whose credential is not shipped to untrusted
visitors. For a public browser, use the restricted runtime provider:

```ts
import { createPromptRailsBrowserProvider } from "@promptrails/ai-chat";

const provider = createPromptRailsBrowserProvider({
  apiKey: "BROWSER_ONLY_CHAT_KEY",
  agentId: "AGENT_KSUID",
  workspaceId: "WORKSPACE_KSUID",
  persistSession: true,
  sessionMaxAge: 86400,
});
```

Never embed an OpenAI/provider key, user JWT, PromptRails management key, or a
browser key with permissions beyond the browser chat runtime in frontend code.

### OpenAI

Trusted/server-side use only. Do not bundle an OpenAI key into a public web
application; expose your own authenticated BFF endpoint to the browser instead.

```ts
import { createOpenAIProvider } from "@promptrails/ai-chat";

const provider = createOpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY!,
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

Human-in-the-loop approval flow. In PromptRails API v2 an approval is an
execution parked at `waiting_approval`; `refresh()` loads that inbox, and
`approve`/`reject` resume the parked execution.

```ts
const {
  pendingApprovals, // ApprovalRequest[]
  approve,          // (id: string, reason?: string) => Promise<void>
  reject,           // (id: string, reason?: string) => Promise<void>
  isDeciding,       // boolean
  addApproval,      // (request: ApprovalRequest) => void
  refresh,          // () => Promise<void> — reload the waiting_approval inbox
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
| `data-workspace-id` | Local session storage namespace | — |
| `data-model` | LLM model name (OpenAI) | `"gpt-4o-mini"` |
| `data-title` | Chat window title | `"Chat"` |
| `data-placeholder` | Input placeholder text | `"Type a message..."` |
| `data-greeting` | Initial greeting message | — |
| `data-position` | `"bottom-right"` or `"bottom-left"` | `"bottom-right"` |
| `data-primary-color` | Hex color for theming | `"#2563eb"` |
| `data-width` | Panel width in pixels | `380` |
| `data-height` | Panel height in pixels | `600` |
| `data-z-index` | CSS z-index | `2147483000` |
| `data-persist-session` | Resume verified history after reload | `true` |
| `data-session-max-age` | Local inactivity lifetime in seconds | `86400` |
| `data-stylesheet-url` | Theme CSS loaded inside Shadow DOM | — |
| `data-new-session-label` | Accessible new-session label | `"New conversation"` |
| `data-feedback-label` | Feedback prompt | `"Was this helpful?"` |

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
