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
  productSource?: "catalog" | "response";
  brand?: string;
  assistantName?: string;
  assistantMark?: string;
  locale?: string;
  accentColor?: string;
  themeCss?: string;
  persistSession?: boolean;
  sessionMaxAge?: number;
  showToolActivity?: boolean;
  showActivityDuration?: boolean;
  toolLabels?: ToolActivityLabels;
  allowedActionOrigins?: string[];
  closeOnProductView?: boolean;
  legalNotice?: string;
  legalUrl?: string;
  legalLinkLabel?: string;
  legalAcceptLabel?: string;
  legalConsentVersion?: string;
  legalConsentMaxAge?: number;
  aiDisclaimer?: string;
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
  ["productSource", "product-source"],
  ["brand", "brand"],
  ["assistantName", "assistant-name"],
  ["assistantMark", "assistant-mark"],
  ["locale", "locale"],
  ["accentColor", "accent-color"],
  ["themeCss", "theme-css"],
  ["persistSession", "persist-session"],
  ["sessionMaxAge", "session-max-age"],
  ["showToolActivity", "show-tool-activity"],
  ["showActivityDuration", "show-activity-duration"],
  ["toolLabels", "tool-labels"],
  ["allowedActionOrigins", "allowed-action-origins"],
  ["closeOnProductView", "close-on-product-view"],
  ["legalNotice", "legal-notice"],
  ["legalUrl", "legal-url"],
  ["legalLinkLabel", "legal-link-label"],
  ["legalAcceptLabel", "legal-accept-label"],
  ["legalConsentVersion", "legal-consent-version"],
  ["legalConsentMaxAge", "legal-consent-max-age"],
  ["aiDisclaimer", "ai-disclaimer"],
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
