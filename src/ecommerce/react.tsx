import "./widget.js";

import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type {
  PromptRailsShopAssistantElement,
  ShopAssistantContext,
  ToolActivityLabels,
} from "./types";

export interface ShopAssistantProps {
  apiUrl?: string;
  apiKey?: string;
  agentId?: string;
  catalogUrl?: string;
  brand?: string;
  assistantName?: string;
  assistantMark?: string;
  locale?: string;
  accentColor?: string;
  persistSession?: boolean;
  sessionMaxAge?: number;
  showToolActivity?: boolean;
  toolLabels?: ToolActivityLabels;
  closeOnProductView?: boolean;
  quickPrompts?: string[];
  translations?: Record<string, string>;
  context?: ShopAssistantContext;
  contextProvider?: () => ShopAssistantContext | Promise<ShopAssistantContext>;
  className?: string;
}

const attributes = [
  ["apiUrl", "api-url"],
  ["apiKey", "api-key"],
  ["agentId", "agent-id"],
  ["catalogUrl", "catalog-url"],
  ["brand", "brand"],
  ["assistantName", "assistant-name"],
  ["assistantMark", "assistant-mark"],
  ["locale", "locale"],
  ["accentColor", "accent-color"],
  ["persistSession", "persist-session"],
  ["sessionMaxAge", "session-max-age"],
  ["showToolActivity", "show-tool-activity"],
  ["toolLabels", "tool-labels"],
  ["closeOnProductView", "close-on-product-view"],
  ["quickPrompts", "quick-prompts"],
  ["translations", "translations"],
] as const;

/** React adapter for the framework-neutral ecommerce custom element. */
export const ShopAssistant = forwardRef<PromptRailsShopAssistantElement, ShopAssistantProps>(
  function ShopAssistant({ context, contextProvider, className, ...props }, forwardedRef) {
    const ref = useRef<PromptRailsShopAssistantElement>(null);

    useImperativeHandle(forwardedRef, () => ref.current as PromptRailsShopAssistantElement, []);

    useEffect(() => {
      const element = ref.current;
      if (!element) return;
      element.contextProvider = contextProvider;
      if (context) element.updateContext(context);
    }, [context, contextProvider]);

    useEffect(() => {
      const element = ref.current;
      if (!element) return;
      for (const [prop, attribute] of attributes) {
        const value = props[prop];
        if (value === undefined || value === null) element.removeAttribute(attribute);
        else if (Array.isArray(value) || typeof value === "object")
          element.setAttribute(attribute, JSON.stringify(value));
        else element.setAttribute(attribute, String(value));
      }
    }, [props]);

    return createElement("promptrails-shop-assistant", { ref, class: className });
  },
);

export default ShopAssistant;
