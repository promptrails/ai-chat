# API reference

## Headless browser runtime

```ts
import { createBrowserChatRuntime } from "@promptrails/ai-chat/browser";

const runtime = createBrowserChatRuntime({
  apiKey: "BROWSER_ONLY_CHAT_KEY",
  agentId: "AGENT_KSUID",
  workspaceId: "WORKSPACE_KSUID",
  persistSession: true,
  sessionMaxAge: 86_400,
  onEvent(event) {
    analytics.track(event.type);
  },
});

for await (const event of runtime.sendMessageStream({
  content: "Is size S available?",
  context: { productId: "linen-dress", path: location.pathname },
})) {
  // content, tool_start, tool_end, ui, done, error...
}
```

| Method | Purpose |
| --- | --- |
| `hydrate()` | Verify a persisted resume capability and return server history. |
| `listMessages()` | Read the active session after authorization. |
| `sendMessageStream(message, signal?)` | Send one retry-safe turn and consume typed SSE events. |
| `newSession()` | Clear and revoke the active resumable conversation. |
| `submitFeedback(executionId, 1 \| -1)` | Submit thumbs up/down feedback. |
| `disconnect()` | Clear the in-memory bearer and close tab coordination. |

## Global widget API

```js
PromptRailsChat.open();
PromptRailsChat.close();
PromptRailsChat.toggle();
await PromptRailsChat.send("Show my latest order");
await PromptRailsChat.newSession();
PromptRailsChat.updateContext({ accountTier: "gold" });
PromptRailsChat.destroy();
```

`contextProvider` may compute fresh context for each message. `onEvent` receives host-owned lifecycle events without installing an analytics vendor.

## Ecommerce Web Component API

```ts
const assistant = document.querySelector("promptrails-shop-assistant")!;
assistant.contextProvider = () => ({
  path: location.pathname,
  productId: document.body.dataset.productId,
});
assistant.updateContext({ campaign: "summer" });
assistant.open();
await assistant.send("Complete this outfit");
```

The package declares `PromptRailsShopAssistantElement`, `ShopAssistantEventMap`, `CartAddDetail`, and related types.

Use `@promptrails/ai-chat/ecommerce` to register the component from ESM or
`@promptrails/ai-chat/ecommerce/react` for the typed `ShopAssistant` React
adapter. Both expose the same custom element and host-owned event contract.

## UI renderer registry

```ts
import { createChatUIRendererRegistry, normalizeChatUI } from "@promptrails/ai-chat/ui";

const renderers = createChatUIRendererRegistry<Node>();
renderers.register({
  kind: "booking",
  render(resource, actions) {
    return renderBookingCard(resource.attributes, actions);
  },
});
```

The registry is framework-independent. React, Vue, Svelte, native Web Components, and server-rendered hosts can supply their own renderer result type.

## Styling and CSP

Both widgets use open Shadow DOM. Use CSS variables for tokens, `::part()` for stable component surfaces, or an explicitly allowed `stylesheetUrl`. Under a nonce-based CSP, pass `styleNonce` / `data-style-nonce` to the generic widget or `style-nonce` to the ecommerce component.

Never derive the nonce from user input. Add the PromptRails API to `connect-src`, the pinned widget asset to `script-src`, and custom stylesheet hosts to `style-src`.
