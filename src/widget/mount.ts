import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { WidgetConfig } from "../types";
import { Widget } from "./widget";
import { WIDGET_CSS } from "./widget-styles";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/**
 * Mount the widget into the DOM using Shadow DOM for style isolation.
 */
export function mount(config: WidgetConfig): void {
  if (root) {
    console.warn("@promptrails/ai-chat: Widget is already mounted.");
    return;
  }

  // Create container element
  container = document.createElement("div");
  container.id = "promptrails-chat-widget";
  document.body.appendChild(container);

  // Create shadow DOM
  const shadow = container.attachShadow({ mode: "open" });

  // Inject styles
  const styleEl = document.createElement("style");
  styleEl.textContent = WIDGET_CSS;

  // Apply custom CSS variables
  if (config.primaryColor) {
    styleEl.textContent += `\n:host { --prc-primary-color: ${config.primaryColor}; }`;
  }
  if (config.width) {
    styleEl.textContent += `\n:host { --prc-panel-width: ${config.width}px; }`;
  }
  if (config.height) {
    styleEl.textContent += `\n:host { --prc-panel-height: ${config.height}px; }`;
  }
  if (config.zIndex) {
    styleEl.textContent += `\n:host { --prc-z-index: ${config.zIndex}; }`;
  }

  shadow.appendChild(styleEl);

  // Create React mount point
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  // Render
  root = createRoot(mountPoint);
  root.render(createElement(Widget, { config }));
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
}
