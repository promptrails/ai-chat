# Ecommerce browser widget

`dist/ecommerce.global.js` registers `<promptrails-shop-assistant>`, a
framework-independent Web Component for storefront sales assistants. It uses
an open Shadow DOM so the widget cannot accidentally leak styles into the host
page. The bundle is vanilla JavaScript and does not include React.

## Install

Pin a release in production:

```html
<script
  src="https://cdn.jsdelivr.net/npm/@promptrails/ai-chat@0.5.0/dist/ecommerce.global.js"
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
></promptrails-shop-assistant>
```

## Browser security boundary

`api-key` is visible to every visitor and therefore must be a PromptRails
browser-only publishable key with:

- exactly `chat:write`,
- one or more explicit allowed agent IDs,
- exact HTTPS origins (localhost HTTP is development-only),
- `browser_only=true`,
- an appropriate key rate limit.

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
  "description": "Zamansız midi elbise",
  "material": "Viskon karışımı",
  "colors": ["Siyah"],
  "sizes": ["S", "M", "L"],
  "tags": ["ofis", "akşam"],
  "imageUrl": "https://cdn.example.com/ece.jpg"
}
```

The public catalog is used only to resolve trusted card fields in the browser.
Do not embed the complete catalog in the prompt. Attach a read-only HTTP API
tool to the PromptRails agent so it searches current product data server-side.
The widget accepts only generic UI `product`, `resource.open`, and `cart.add`
kinds and ignores unknown actions.

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

For a fully custom theme, set `stylesheet-url` to an HTTPS or same-site CSS
file. It is loaded inside the Shadow DOM after the built-in styles, so scoped
selectors such as `.panel`, `.recommendation`, and `.composer` can override the
default editorial theme. Include the CSS origin in the site's `style-src` CSP.

## JavaScript customization

Commerce side effects belong to the host site. The widget emits composed DOM
events instead of calling a cart backend itself:

```js
document.addEventListener("promptrails:product-view", (event) => {
  location.assign(`/products/${event.detail.slug}`);
});

document.addEventListener("promptrails:cart-add", async (event) => {
  await cart.add(event.detail);
  document.dispatchEvent(new CustomEvent("promptrails:cart-confirmed", {
    detail: { productId: event.detail.productId },
  }));
});

document.addEventListener("promptrails:session-new", () => {
  analytics.track("assistant_session_started");
});
```

Event payloads never execute model-provided JavaScript or URLs. Product names,
prices, images, and slugs are resolved from the host catalog by ID.
