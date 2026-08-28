# Migrating to v0.8

v0.8 is additive. Existing generic and ecommerce widget integrations continue
to work without attribute changes.

## Explicit legal consent

Set `legal-notice` and `legal-url` to require a visitor to accept the notice
before the composer is available. `legal-consent-version` invalidates previous
acceptance when the legal text changes, while `legal-consent-max-age` controls
the persistence window in days. Listen for `promptrails:legal-consent` when the
host needs an analytics record of the browser-side acceptance event.

`ai-disclaimer` adds a compact permanent notice below the composer.

## Product cards

- `compare_at_price` / `compareAtPrice` renders a verified reference price.
- The product title uses the same sanitized product URL as the inspect action.
- A single size or color renders as a locked value, not a selector.
- Existing `selected_size` and `selected_color` values remain the default when
  they match a sanitized option.

Update the pinned dependency or immutable CDN URL to
`@promptrails/ai-chat@0.8.0`, then rebuild the host application.
