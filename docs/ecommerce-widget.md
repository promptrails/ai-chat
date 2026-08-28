# Ecommerce browser widget

`dist/ecommerce.global.js` registers `<promptrails-shop-assistant>`, a
framework-independent Web Component for storefront sales assistants. It uses
an open Shadow DOM so the widget cannot accidentally leak styles into the host
page. The bundle is vanilla JavaScript and does not include React

## Install

Pin a release in production:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat@0.8.3/dist/ecommerce.global.js"
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
  launcher-title="Alışveriş asistanı"
  launcher-subtitle="Size özel öneriler"
  greeting="Merhaba, aradığınız ürünü birlikte bulalım."
  placeholder="Nasıl bir ürün arıyorsunuz?"
  quick-prompts='["Yeni gelenler","Bütçeme göre öner"]'
  currency="TRY"
  locale="tr-TR"
  accent-color="#121212"
  persist-session="true"
  session-max-age="86400"
  show-tool-activity="true"
  show-activity-duration="false"
  legal-notice="Devam ederek kişisel veri politikasını kabul edersiniz."
  legal-url="https://shop.example.com/privacy"
  legal-link-label="Gizlilik politikası"
  legal-accept-label="Kabul et"
  legal-consent-version="2026-08"
  legal-consent-max-age="180"
  ai-disclaimer="Yanıtlar yapay zekâ tarafından oluşturulur ve hata içerebilir."
  allowed-action-origins='["https://api.whatsapp.com"]'
  close-on-product-view="true"
  tool-labels='{"catalog_search":"Searching the collection…","knowledge_search":"Checking the store guide…"}'
></promptrails-shop-assistant>
```

## Explicit legal consent

Set both `legal-notice` and `legal-url` to lock the composer behind an explicit
accept action. The widget persists the accepted `legal-consent-version` in
localStorage and uses a SameSite cookie as a fallback. The record is scoped to
the current workspace and agent; changing the version asks the visitor again.
`legal-consent-max-age` is expressed in days, defaults to 180, and is capped at
365. Acceptance emits a composed `promptrails:legal-consent` event containing
the accepted version and timestamp. `ai-disclaimer` adds a permanent compact
notice below the composer.

## Browser security boundary

`api-key` is visible to every visitor and therefore must be a PromptRails
browser-only publishable key with:

- exactly `chat:write`,
- one or more explicit allowed agent IDs,
- exact HTTPS origins (localhost HTTP is development-only),
- `browser_only=true`,
- an appropriate key rate limit.

Resuming a persisted conversation does not grant the public key broad read
access. History reads require both the short-lived browser token and the opaque
resume capability bound to that session.

The key is used only for `/api/v1/browser/chat/token`. The returned bearer is
kept in memory for 15 minutes and refreshed before expiry. Every session
operation also requires a random resume secret that PromptRails stores only as
a hash and binds to the API key and exact origin. Provider credentials, user
JWTs, tool secrets, and management keys must never be rendered into the page.

With persistence enabled, the widget stores the session ID, the single-session
resume capability, `lastActivityAt`, and at most 20 rendered messages. The
default inactivity window is 86,400 seconds and the client hard-caps it at 30
days. Use `persist-session="false"` on kiosks or shared devices.

## Catalog contract

`catalog-url` must return either `{ "products": [...] }` or
`{ "data": { "products": [...] } }`. Product records support:

```json
{
  "id": "dress-ece-black",
  "slug": "ece-asimetrik-midi-elbise-siyah",
  "name": "Ece Asimetrik Midi Elbise",
  "category": "Elbiseler",
  "price": 5990,
  "compare_at_price": 6490,
  "description": "Zamansız midi elbise",
  "material": "Viskon karışımı",
  "colors": ["Siyah"],
  "sizes": ["S", "M", "L"],
  "selected_color": "Siyah",
  "selected_size": "M",
  "tags": ["ofis", "akşam"],
  "imageUrl": "https://cdn.example.com/ece.jpg"
}
```

The public catalog is used only to resolve trusted card fields in the browser.
Do not embed the complete catalog in the prompt. Attach a read-only HTTP API
tool to the PromptRails agent so it searches current product data server-side.
The widget accepts only generic UI `product`, `resource.open`, and `cart.add`
kinds and ignores unknown actions.

### Products from the structured response

If the agent tool response is already the source of truth and includes the
complete card fields, the browser does not need a second catalog endpoint:

```html
<promptrails-shop-assistant
  product-source="response"
  api-url="https://api.promptrails.ai"
  agent-id="AGENT_KSUID"
  api-key="BROWSER_ONLY_CHAT_KEY"
></promptrails-shop-assistant>
```

This mode is opt-in. It accepts `id`, `name`, category, price, description,
HTTP(S) product URL, HTTP(S) images, sizes, and colors from the structured
response, strips markup, bounds text and list sizes, and ignores executable or
unknown fields. Ticimax-style nested `category`, `price`, `images`, and
`variants` values are normalized automatically. The `promptrails:product-view`
event may include the sanitized `url`; the host must allowlist its own
storefront origin before navigation. Default `product-source="catalog"`
behavior remains unchanged and is preferable when the model output contains
only product IDs.

Use optional `selected_size` and `selected_color` fields when the shopper has
already requested a specific variant. The widget preselects a value only when
it is present in that product's sanitized `sizes` or `colors` list; invalid or
hallucinated selections are ignored. Camel-case `selectedSize` and
`selectedColor` aliases are also accepted.

Verified `compare_at_price` / `compareAtPrice` values render as a struck-through
reference price only when they are greater than the current price. Product
titles link to the same sanitized product URL as the inspect action. A single
size or color is rendered as a locked value instead of a misleading selector.

For direct storefront cart integrations, include the verified tool-provided
`selected_variant_id`. The sanitized value is emitted as `variantId` on
`promptrails:cart-add`, allowing the host page to call its native cart API from
any page without navigating to the product detail. Never derive this identifier
from model text; it must come from the selected in-stock catalog variant.

It also renders declarative `order`, `order_tracking`, and `status` resources as inert status cards. No model-provided script or navigation URL is executed.

## Safe standalone actions

Set `allowed-action-origins` to the smallest exact origin allowlist needed by
the storefront. The widget converts a declarative, resource-less
`resource.open` action or a matching HTTPS URL in assistant text into a CTA
(localhost HTTP remains available for development):

```html
<promptrails-shop-assistant
  allowed-action-origins='["https://api.whatsapp.com"]'
></promptrails-shop-assistant>
```

WhatsApp links receive the localized `WhatsApp'tan yaz` label automatically.
Allowed links open in a new tab with `noopener noreferrer`. URLs from any other
external origin, non-HTTP(S) schemes, scripts, and arbitrary model payloads are
never turned into navigation. Same-origin links are allowed automatically.
The React adapter exposes the same option as `allowedActionOrigins` and emits
`promptrails:action-open` for analytics immediately before native navigation.

## CSS customization

CSS custom properties cross the Shadow DOM host boundary:

```css
promptrails-shop-assistant {
  --pt-chat-accent: #111111;
  --pt-chat-on-accent: #ffffff;
  --pt-chat-background: #f7f5f0;
  --pt-chat-surface: #ffffff;
  --pt-chat-text: #171715;
  --pt-chat-muted: #68655f;
  --pt-chat-border: #d7d2c9;
  --pt-chat-font-family: Inter, sans-serif;
  --pt-chat-radius: 0;
  --pt-chat-shadow: 0 24px 70px rgb(0 0 0 / 27%);
  --pt-chat-launcher-width: 230px;
  --pt-chat-launcher-radius: 2px;
  --pt-chat-right: 24px;
  --pt-chat-bottom: 24px;
  --pt-chat-z-index: 2147483000;
}
```

Stable parts include `launcher`, `panel`, `header`, `messages`, `composer`, `footer`, `message`, `product-card`, `status-card`, `action`, `activity`, `legal-consent`, and `ai-disclaimer`. Use `style-nonce` under a nonce-based CSP.

For a fully custom theme, set `stylesheet-url` to an HTTPS or same-site CSS
file. It is loaded inside the Shadow DOM after the built-in styles, so scoped
selectors such as `.panel`, `.recommendation`, and `.composer` can override the
default editorial theme. Include the CSS origin in the site's `style-src` CSP.

For a self-contained embed, set `theme-css` to the complete theme string. The
widget owns and reapplies this style after every internal render, including
legal-consent acceptance and new-session transitions. The value is assigned as
CSS text rather than parsed as HTML; use `style-nonce` when the host CSP requires
one.

## JavaScript customization

Commerce side effects belong to the host site. The widget emits composed DOM
events instead of calling a cart backend itself:

```js
document.addEventListener("promptrails:product-view", (event) => {
  location.assign(`/products/${event.detail.slug}`);
});

document.addEventListener("promptrails:cart-add", async (event) => {
  try {
    await cart.add(event.detail);
    document.dispatchEvent(new CustomEvent("promptrails:cart-confirmed", {
      detail: { productId: event.detail.productId },
    }));
  } catch {
    document.dispatchEvent(new CustomEvent("promptrails:cart-failed", {
      detail: { productId: event.detail.productId },
    }));
  }
});

document.addEventListener("promptrails:session-new", () => {
  analytics.track("assistant_session_started");
});
```

Product views close the panel before emitting `promptrails:product-view` by default so client-side navigation is visible. Set `close-on-product-view="false"` if the host intentionally keeps the assistant open. Cart buttons recover when the host emits `promptrails:cart-failed`; a ten-second confirmation timeout also prevents a permanently disabled button.

The component also exposes a typed imperative API:

```js
const assistant = document.querySelector("promptrails-shop-assistant");
assistant.contextProvider = () => ({ productId: window.currentProductId });
assistant.updateContext({ campaign: "summer" });
assistant.open();
await assistant.send("Bu ürünü tamamlayan bir çanta bul");
await assistant.newSession();
```

Use `locale="en-US"` for the built-in English dictionary or pass a JSON `translations` attribute to override individual labels. Product cards support size, color, and quantity selection before emitting `promptrails:cart-add`.

## Tool activity

The widget consumes PromptRails `tool_start` and `tool_end` stream events and shows customer-safe progress copy while the assistant works. Raw tool arguments, results, and private tool names are never rendered. Unknown tools use a generic localized message.

Use `tool-labels` to provide brand-specific copy keyed by tool name:

```html
<promptrails-shop-assistant
  show-tool-activity="true"
  tool-labels='{
    "catalog_search":"Searching the collection…",
    "order_tracking":"Checking your shipment…",
    "knowledge_search":"Checking the store guide…"
  }'
></promptrails-shop-assistant>
```

Set `show-tool-activity="false"` to retain the generic typing indicator without tool-specific updates. Elapsed seconds are hidden by default; set `show-activity-duration="true"` only when the storefront explicitly wants a timer. The React adapter exposes the same options as `showToolActivity`, `showActivityDuration`, and `toolLabels`.

On mobile Safari the widget keeps composer and variant controls at a minimum 16px font size, preventing iOS from leaving the page auto-zoomed after focus. The fixed panel uses safe-area insets and does not rely on a competing viewport width declaration.

Event payloads never execute model-provided JavaScript. Standalone links require
an explicit exact-origin allowlist and remain native, isolated anchors. In the default
catalog mode, product names, prices, images, and slugs are resolved from the
host catalog by ID. In response mode, HTTP(S) fields are sanitized and emitted
as inert data for the host to validate and handle.

## ESM and React

Importing the ESM entry registers the same framework-neutral custom element:

```ts
import "@promptrails/ai-chat/ecommerce";
```

React applications can use the typed adapter and keep the imperative API on a ref:

```tsx
import { useRef } from "react";
import { ShopAssistant } from "@promptrails/ai-chat/ecommerce/react";
import type { PromptRailsShopAssistantElement } from "@promptrails/ai-chat/ecommerce";

export function StorefrontAssistant() {
  const assistant = useRef<PromptRailsShopAssistantElement>(null);
  return (
    <ShopAssistant
      ref={assistant}
      apiKey="BROWSER_ONLY_CHAT_KEY"
      agentId="AGENT_KSUID"
      catalogUrl="/api/catalog"
      contextProvider={() => ({ path: location.pathname })}
    />
  );
}
```

Release assets include source maps and `integrity.json` with SHA-384 hashes for
the two global bundles and the shared stylesheet.
