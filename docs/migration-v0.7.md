# Migrating to v0.7

v0.7 is additive. Existing generic and ecommerce widget integrations continue to work without attribute changes.

## Ecommerce improvements

- Tool stream activity is customer-safe and enabled by default. Customize it with `tool-labels` or disable tool-specific updates with `show-tool-activity="false"`.
- Product views close the panel by default so client-side navigation is visible. Set `close-on-product-view="false"` to retain the previous behavior.
- Cart integrations may emit `promptrails:cart-failed` to restore the add button. A ten-second confirmation timeout prevents a permanently disabled state.
- Mobile controls use an iOS-safe 16px font size and the panel is constrained to the dynamic viewport.
- Ecommerce action labels use the widget dictionary, keeping buttons concise and independent of model-generated copy.

Update the pinned dependency or immutable CDN URL to `@promptrails/ai-chat@0.7.0`, then rebuild the host application.
