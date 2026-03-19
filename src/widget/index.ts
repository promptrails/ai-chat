import type { WidgetConfig } from "../types";
import { parseScriptTagConfig, resolveConfig } from "./config";
import { mount, unmount } from "./mount";

let currentConfig: WidgetConfig | null = null;
let isOpen = false;

/**
 * Initialize the chat widget programmatically.
 *
 * @example
 * ```js
 * PromptRailsChat.init({
 *   provider: { type: 'promptrails', apiKey: 'pk_...', baseUrl: 'https://api.example.com', agentId: 'abc', workspaceId: 'ws1' },
 *   title: 'Support Chat',
 *   position: 'bottom-right',
 * });
 * ```
 */
function init(config: Partial<WidgetConfig>): void {
  if (currentConfig) {
    console.warn("@promptrails/ai-chat: Widget already initialized. Call destroy() first.");
    return;
  }

  currentConfig = resolveConfig(config);
  mount(currentConfig);
}

/** Open the chat panel. */
function open(): void {
  isOpen = true;
  const bubble = document
    .querySelector("#promptrails-chat-widget")
    ?.shadowRoot?.querySelector(".prc-widget-bubble") as HTMLElement | null;
  bubble?.click();
}

/** Close the chat panel. */
function close(): void {
  isOpen = false;
  const closeBtn = document
    .querySelector("#promptrails-chat-widget")
    ?.shadowRoot?.querySelector(".prc-widget-header-close") as HTMLElement | null;
  closeBtn?.click();
}

/** Toggle the chat panel. */
function toggle(): void {
  if (isOpen) {
    close();
  } else {
    open();
  }
}

/** Remove the widget from the DOM. */
function destroy(): void {
  unmount();
  currentConfig = null;
  isOpen = false;
}

// Public API
const PromptRailsChat = { init, open, close, toggle, destroy };

// Auto-init from script tag data attributes
if (typeof document !== "undefined") {
  const scriptConfig = parseScriptTagConfig();
  if (scriptConfig?.provider?.type) {
    // Wait for DOM ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => init(scriptConfig));
    } else {
      init(scriptConfig);
    }
  }
}

export default PromptRailsChat;
export { init, open, close, toggle, destroy };
