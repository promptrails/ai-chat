import type { WidgetConfig } from "../types";
import { parseScriptTagConfig, resolveConfig } from "./config";
import { mount, unmount } from "./mount";
import type { WidgetController } from "../types";

let currentConfig: WidgetConfig | null = null;
let controller: Omit<WidgetController, "destroy"> | null = null;
let queuedContext: Record<string, unknown> = {};

/**
 * Initialize the chat widget programmatically.
 *
 * @example
 * ```js
 * PromptRailsChat.init({
 *   provider: { type: 'promptrails', apiKey: 'pr_...', agentId: 'abc' },
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
  controller = mount(currentConfig);
  controller.updateContext(queuedContext);
}

/** Open the chat panel. */
function open(): void {
  controller?.open();
}

/** Close the chat panel. */
function close(): void {
  controller?.close();
}

/** Toggle the chat panel. */
function toggle(): void {
  controller?.toggle();
}

/** Send a message and open the panel. */
async function send(content: string): Promise<void> {
  if (!controller) throw new Error("@promptrails/ai-chat: Call init() before send().");
  await controller.send(content);
}

/** Clear the resumable conversation and start fresh. */
async function newSession(): Promise<void> {
  await controller?.newSession();
}

/** Merge trusted host context into future messages. */
function updateContext(context: Record<string, unknown>): void {
  queuedContext = { ...queuedContext, ...context };
  controller?.updateContext(context);
}

/** Remove the widget from the DOM. */
function destroy(): void {
  unmount();
  currentConfig = null;
  controller = null;
  queuedContext = {};
}

// Public API
const PromptRailsChat: WidgetController & { init: typeof init } = {
  init,
  open,
  close,
  toggle,
  send,
  newSession,
  updateContext,
  destroy,
};

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
export { init, open, close, toggle, send, newSession, updateContext, destroy };
