import type { WidgetConfig } from "../types";

/**
 * Parse widget configuration from a script tag's data attributes.
 */
export function parseScriptTagConfig(): Partial<WidgetConfig> | null {
  if (typeof document === "undefined") return null;

  const script = document.currentScript as HTMLScriptElement | null;
  if (!script) return null;

  const providerType = script.dataset.provider;
  if (!providerType) return null;

  return {
    provider: {
      type: providerType as WidgetConfig["provider"]["type"],
      apiKey: script.dataset.apiKey,
      baseUrl: script.dataset.baseUrl,
      agentId: script.dataset.agentId,
      model: script.dataset.model,
    },
    position: (script.dataset.position as WidgetConfig["position"]) ?? "bottom-right",
    title: script.dataset.title,
    placeholder: script.dataset.placeholder,
    primaryColor: script.dataset.primaryColor,
    greeting: script.dataset.greeting,
    width: script.dataset.width ? parseInt(script.dataset.width, 10) : undefined,
    height: script.dataset.height ? parseInt(script.dataset.height, 10) : undefined,
    zIndex: script.dataset.zIndex ? parseInt(script.dataset.zIndex, 10) : undefined,
  };
}

/**
 * Merge user config with defaults.
 */
export function resolveConfig(config: Partial<WidgetConfig>): WidgetConfig {
  if (!config.provider?.type) {
    throw new Error(
      "@promptrails/ai-chat: provider.type is required. Use 'promptrails', 'openai', or 'custom'.",
    );
  }

  if (!config.provider.apiKey) {
    throw new Error("@promptrails/ai-chat: provider.apiKey is required.");
  }

  if (config.provider.type === "promptrails" && !config.provider.agentId) {
    throw new Error("@promptrails/ai-chat: provider.agentId is required for PromptRails provider.");
  }

  return {
    provider: config.provider as WidgetConfig["provider"],
    position: config.position ?? "bottom-right",
    title: config.title ?? "Chat",
    placeholder: config.placeholder ?? "Type a message...",
    primaryColor: config.primaryColor,
    greeting: config.greeting,
    width: config.width,
    height: config.height,
    zIndex: config.zIndex,
  };
}
