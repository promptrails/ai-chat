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
    workspaceId: script.dataset.workspaceId,
    persistSession: script.dataset.persistSession !== "false",
    sessionMaxAge: script.dataset.sessionMaxAge
      ? parseInt(script.dataset.sessionMaxAge, 10)
      : undefined,
    stylesheetUrl: script.dataset.stylesheetUrl,
    newSessionLabel: script.dataset.newSessionLabel,
    feedbackLabel: script.dataset.feedbackLabel,
    errorMessage: script.dataset.errorMessage,
    greeting: script.dataset.greeting,
    width: script.dataset.width ? parseInt(script.dataset.width, 10) : undefined,
    height: script.dataset.height ? parseInt(script.dataset.height, 10) : undefined,
    zIndex: script.dataset.zIndex ? parseInt(script.dataset.zIndex, 10) : undefined,
    styleNonce: script.dataset.styleNonce,
    locale: script.dataset.locale,
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

  const locale =
    config.locale || (typeof document !== "undefined" ? document.documentElement.lang : "") || "en";
  const turkish = locale.toLocaleLowerCase().startsWith("tr");
  const defaults = turkish
    ? {
        open: "Sohbeti aç",
        close: "Sohbeti kapat",
        send: "Mesajı gönder",
        newSession: "Yeni sohbet",
        helpful: "Yardımcı oldu",
        notHelpful: "Yardımcı olmadı",
        empty: "Bir sohbet başlatın",
        offline: "Çevrimdışısınız. Bağlantınızı kontrol edin.",
      }
    : {
        open: "Open chat",
        close: "Close chat",
        send: "Send message",
        newSession: "New conversation",
        helpful: "Helpful",
        notHelpful: "Not helpful",
        empty: "Start a conversation",
        offline: "You are offline. Check your connection.",
      };

  return {
    provider: config.provider as WidgetConfig["provider"],
    position: config.position ?? "bottom-right",
    title: config.title ?? "Chat",
    placeholder: config.placeholder ?? "Type a message...",
    primaryColor: config.primaryColor,
    workspaceId: config.workspaceId,
    persistSession: config.persistSession ?? true,
    sessionMaxAge: config.sessionMaxAge,
    stylesheetUrl: config.stylesheetUrl,
    newSessionLabel: config.newSessionLabel ?? config.labels?.newSession ?? defaults.newSession,
    feedbackLabel: config.feedbackLabel ?? "Was this helpful?",
    errorMessage: config.errorMessage ?? "Chat is temporarily unavailable. Please try again.",
    greeting: config.greeting,
    width: config.width,
    height: config.height,
    zIndex: config.zIndex,
    styleNonce: config.styleNonce,
    locale,
    contextProvider: config.contextProvider,
    onEvent: config.onEvent,
    labels: { ...defaults, ...config.labels },
  };
}
