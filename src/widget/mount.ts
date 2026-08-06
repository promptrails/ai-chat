import { createElement, createRef, type Ref } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { WidgetConfig } from "../types";
import { Widget, type WidgetHandle } from "./widget";
import { WIDGET_CSS } from "./widget-styles";

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let widgetRef: React.RefObject<WidgetHandle | null> | null = null;

/**
 * Mount the widget into the DOM using Shadow DOM for style isolation.
 */
export function mount(config: WidgetConfig): WidgetHandle {
  if (root) {
    console.warn("@promptrails/ai-chat: Widget is already mounted.");
    throw new Error("@promptrails/ai-chat: Widget is already mounted.");
  }

  // Create container element (fixed position, zero size to prevent scroll)
  container = document.createElement("div");
  container.id = "promptrails-chat-widget";
  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "0";
  container.style.width = "0";
  container.style.height = "0";
  container.style.overflow = "visible";
  container.style.zIndex = String(config.zIndex ?? 2147483000);
  container.setAttribute("data-promptrails-widget", "");
  document.body.appendChild(container);

  // Create shadow DOM
  const shadow = container.attachShadow({ mode: "open" });

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = WIDGET_CSS;
  if (config.styleNonce) styleEl.nonce = config.styleNonce;

  // Apply custom CSS variables
  if (config.primaryColor) container.style.setProperty("--prc-primary-color", config.primaryColor);
  if (config.width) container.style.setProperty("--prc-panel-width", `${config.width}px`);
  if (config.height) container.style.setProperty("--prc-panel-height", `${config.height}px`);
  if (config.zIndex) container.style.setProperty("--prc-z-index", String(config.zIndex));

  shadow.appendChild(styleEl);

  if (config.stylesheetUrl && /^(https?:\/\/|\/|\.\.\/|\.\/)/.test(config.stylesheetUrl)) {
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = config.stylesheetUrl;
    shadow.appendChild(stylesheet);
  }

  // Create React mount point
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Render
  root = createRoot(mountPoint);
  widgetRef = createRef<WidgetHandle>();
  root.render(createElement(Widget, { config, ref: widgetRef as Ref<WidgetHandle> }));

  return {
    open: () => widgetRef?.current?.open(),
    close: () => widgetRef?.current?.close(),
    toggle: () => widgetRef?.current?.toggle(),
    send: async (content) => widgetRef?.current?.send(content),
    newSession: async () => widgetRef?.current?.newSession(),
    updateContext: (context) => widgetRef?.current?.updateContext(context),
  };
}

/**
 * Unmount the widget from the DOM.
 */
export function unmount(): void {
  if (root) {
    root.unmount();
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
  widgetRef = null;
}
