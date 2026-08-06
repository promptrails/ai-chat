/* global document, Event */
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

  it("hides the page context envelope when restoring locally persisted messages", () => {
    const storageKey = "promptrails-shop-widget:workspace-1:agent-1";
    globalThis.localStorage.setItem(
      storageKey,
      JSON.stringify({
        chatId: "a".repeat(27),
        resumeToken: "r".repeat(32),
        messages: [
          {
            role: "user",
            text: [
              "<SAYFA_BAGLAMI>",
              '{"baslik":"Sipariş ve Kargo Takibi — MİRA","yol":"/siparis-takip"}',
              "</SAYFA_BAGLAMI>",
              "<MUSTERI_MESAJI>",
              "Siparişim nerede?",
              "</MUSTERI_MESAJI>",
            ].join("\n"),
          },
        ],
        lastActivityAt: Date.now(),
      }),
    );

    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("workspace-id", "workspace-1");
    widget.setAttribute("agent-id", "agent-1");
    document.body.appendChild(widget);

    expect(widget.messages[0].text).toBe("Siparişim nerede?");
    expect(widget.shadowRoot?.querySelector(".message.user p")?.textContent).toBe(
      "Siparişim nerede?",
    );
  });

  it("hides the page context envelope when hydrating messages from the API", async () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("api-url", "https://api.example.com");
    widget.setAttribute("agent-id", "agent-1");
    widget.setAttribute("api-key", "browser-key");
    document.body.appendChild(widget);
    widget.runtime = {
      hydrate: vi.fn().mockResolvedValue([
        {
          role: "user",
          content: [
            "<SAYFA_BAGLAMI>",
            '{"baslik":"Sipariş ve Kargo Takibi — MİRA","yol":"/siparis-takip"}',
            "</SAYFA_BAGLAMI>",
            "<MUSTERI_MESAJI>",
            "elif@mira.example MIRA-2026-1042",
            "</MUSTERI_MESAJI>",
          ].join("\n"),
        },
      ]),
    };

    await widget.hydrateSession();

    expect(widget.messages[0].text).toBe("elif@mira.example MIRA-2026-1042");
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

  it("keeps structured page context out of the visible user message", async () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    const sent = [];
    widget.ready = true;
    widget.runtime = {
      async *sendMessageStream(message) {
        sent.push(message);
        yield { type: "done", output: { message: "Yanıt" } };
      },
    };
    widget.contextProvider = () => ({ productId: "product-1" });
    widget.updateContext({ campaign: "summer" });

    await widget.send("S bedeni var mı?");

    expect(sent[0]).toMatchObject({
      content: "S bedeni var mı?",
      context: { productId: "product-1", campaign: "summer" },
    });
    expect(widget.shadowRoot?.querySelector(".message.user p")?.textContent).toBe(
      "S bedeni var mı?",
    );
    expect(widget.shadowRoot?.textContent).not.toContain("productId");
  });

  it("exposes imperative controls, translated labels and CSP nonce", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("locale", "en-US");
    widget.setAttribute("style-nonce", "nonce-123");
    document.body.appendChild(widget);

    widget.open();
    expect(widget.shadowRoot?.querySelector(".panel")?.classList.contains("is-open")).toBe(true);
    expect(widget.shadowRoot?.querySelector(".welcome h2")?.textContent).toBe(
      "Let's find it together.",
    );
    expect(widget.shadowRoot?.querySelector("style")?.getAttribute("nonce")).toBe("nonce-123");
    widget.close();
    expect(widget.shadowRoot?.querySelector(".panel")?.classList.contains("is-open")).toBe(false);
  });

  it("emits selected variant and quantity without executing model data", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    widget.catalog = [
      {
        id: "product-1",
        slug: "dress",
        name: "Dress",
        category: "Dresses",
        price: 100,
        sizes: ["S", "M"],
        colors: ["Black", "Red"],
      },
    ];
    widget.messages = [
      { role: "assistant", text: "Pick", products: [{ ...widget.catalog[0], canAdd: true }] },
    ];
    const listener = vi.fn();
    widget.addEventListener("promptrails:cart-add", listener);
    widget.paintMessages();
    const selects = widget.shadowRoot.querySelectorAll("[data-variant]");
    selects[0].value = "M";
    selects[0].dispatchEvent(new Event("change"));
    selects[1].value = "Red";
    selects[1].dispatchEvent(new Event("change"));
    selects[2].value = "2";
    selects[2].dispatchEvent(new Event("change"));
    widget.shadowRoot.querySelector("[data-add]").click();

    expect(listener.mock.calls[0][0].detail).toMatchObject({
      productId: "product-1",
      size: "M",
      color: "Red",
      quantity: 2,
    });
  });
});
