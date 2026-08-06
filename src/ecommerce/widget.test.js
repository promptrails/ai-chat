/* global document */
import { beforeEach, describe, expect, it, vi } from "vitest";

import "./widget.js";

describe("PromptRails ecommerce widget", () => {
  beforeEach(() => {
    const values = new Map();
    const storage = {
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      removeItem: (key) => values.delete(key),
      setItem: (key, value) => values.set(key, String(value)),
    };
    vi.stubGlobal("localStorage", storage);
    vi.stubGlobal("sessionStorage", storage);
    document.body.innerHTML = "";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ products: [] }),
      }),
    );
  });

  it("registers an isolated and brand-configurable custom element", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("brand", "Acme");
    widget.setAttribute("assistant-name", "Acme Alışveriş Asistanı");
    widget.setAttribute("assistant-mark", "A");
    widget.setAttribute("quick-prompts", '["Yeni gelenler","1000 TL altı"]');
    document.body.appendChild(widget);

    expect(widget.shadowRoot).not.toBeNull();
    expect(widget.shadowRoot?.querySelector(".launcher-mark")?.textContent).toBe("A");
    expect(widget.shadowRoot?.querySelector("section")?.getAttribute("aria-label")).toBe(
      "Acme Alışveriş Asistanı",
    );
    expect(widget.shadowRoot?.querySelectorAll(".quick.initial button")).toHaveLength(2);
  });

  it("drops persisted state without a valid activity timestamp", () => {
    const storageKey = "promptrails-shop-widget:workspace-1:agent-1";
    globalThis.localStorage.setItem(
      storageKey,
      JSON.stringify({ chatId: "a".repeat(27), resumeToken: "r".repeat(32), messages: [] }),
    );

    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("workspace-id", "workspace-1");
    widget.setAttribute("agent-id", "agent-1");
    document.body.appendChild(widget);

    expect(globalThis.localStorage.getItem(storageKey)).toBeNull();
  });

  it("rejects non-http product image protocols", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    widget.messages = [
      {
        role: "assistant",
        text: "Öneri",
        products: [
          {
            id: "product-1",
            name: "Ürün",
            category: "Kategori",
            price: 100,
            imageUrl: "javascript:alert(1)",
          },
        ],
      },
    ];
    widget.paintMessages();

    const style = widget.shadowRoot?.querySelector(".recommendation-image")?.getAttribute("style");
    expect(style).not.toContain("javascript:");
  });
});
