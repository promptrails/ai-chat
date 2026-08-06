import type { BrowserRuntimeEvent } from "../browser";

export interface ShopAssistantContext {
  [key: string]: unknown;
}

/** Customer-safe progress copy keyed by the server-side tool name. */
export type ToolActivityLabels = Record<string, string>;

export interface ProductViewDetail {
  productId: string;
  slug: string;
}

export interface CartAddDetail extends ProductViewDetail {
  size?: string;
  color?: string;
  quantity: number;
}

export interface ShopAssistantEventMap {
  "promptrails:open": CustomEvent<Record<string, never>>;
  "promptrails:close": CustomEvent<Record<string, never>>;
  "promptrails:session-new": CustomEvent<Record<string, never>>;
  "promptrails:product-view": CustomEvent<ProductViewDetail>;
  "promptrails:cart-add": CustomEvent<CartAddDetail>;
  "promptrails:feedback": CustomEvent<{ executionId: string; value: 1 | -1 }>;
  "promptrails:runtime": CustomEvent<BrowserRuntimeEvent>;
  "promptrails:error": CustomEvent<{ code: string }>;
}

export interface PromptRailsShopAssistantElement extends HTMLElement {
  contextProvider?: () => ShopAssistantContext | Promise<ShopAssistantContext>;
  open(): void;
  close(): void;
  toggle(next: boolean): void;
  send(content: string): Promise<void>;
  newSession(): Promise<void>;
  updateContext(context: ShopAssistantContext): void;
  destroy(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    "promptrails-shop-assistant": PromptRailsShopAssistantElement;
  }
}
