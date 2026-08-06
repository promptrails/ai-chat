# Migrating to v0.6

v0.6 keeps the existing script attributes, Web Component tag, React provider, catalog response, and storefront DOM events. The upgrade is additive for normal integrations.

## Recommended changes

1. Pin `@promptrails/ai-chat@0.6.0`.
2. Update the agent prompt to declare and consume an optional `context` input instead of parsing `<SAYFA_BAGLAMI>` or `<MUSTERI_MESAJI>` envelopes.
3. Use `contextProvider` or `updateContext()` to pass page/product/account state.
4. Replace hard-coded widget strings with `locale`, `labels`, or the ecommerce `translations` JSON.
5. Add a CSP nonce when the host uses nonce-based `style-src`.
6. Listen to `promptrails:runtime` or the generic `onEvent` hook for host-owned observability.

## Persisted sessions

Existing ecommerce localStorage records are migrated automatically. Credentials move to the shared runtime session record; rendered UI messages remain in their own bounded record. The access bearer continues to live only in memory.

## Custom UI output

Use version `1` resources/actions and `normalizeChatUI()`. Unknown or dangling actions are discarded. Ecommerce product actions must reference a product ID present in the host catalog.
