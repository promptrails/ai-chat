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

  it("renders sanitized products directly from structured responses when explicitly enabled", async () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    await Promise.resolve();

    const answer = widget.normalizeAnswer({
      output: {
        message: "Size iki seçenek buldum.",
        products: [{
          id: "ticimax-42",
          name: "<b>İpek Elbise</b>",
          category: { id: "7", name: "Elbise" },
          url: "https://www.example.com/ipek-elbise",
          images: [{ url: "https://cdn.example.com/ipek-elbise.jpg" }],
          price: { min: 3499, currency: "TRY" },
          variants: [
            { color: "Siyah", size: "S", stock: 2 },
            { color: "Siyah", size: "M", stock: 1 },
          ],
          selected_size: "M",
          selected_color: "Siyah",
          reason: "Davet stilinize uygun.",
        }],
      },
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(answer.products).toEqual([expect.objectContaining({
      id: "ticimax-42",
      name: "İpek Elbise",
      category: "Elbise",
      url: "https://www.example.com/ipek-elbise",
      imageUrl: "https://cdn.example.com/ipek-elbise.jpg",
      price: 3499,
      sizes: ["S", "M"],
      colors: ["Siyah"],
      selectedSize: "M",
      selectedColor: "Siyah",
    })]);
  });

  it("preselects validated response variants and uses them for cart events", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Pick",
      products: [{
        id: "product-38",
        slug: "black-dress",
        name: "Black Dress",
        category: "Dresses",
        price: 100,
        sizes: ["34", "36", "38", "40"],
        colors: ["Black", "Red"],
        selectedSize: "38",
        selectedColor: "Red",
        canAdd: true,
      }],
    }];
    const listener = vi.fn();
    widget.addEventListener("promptrails:cart-add", listener);

    widget.paintMessages();

    const selects = widget.shadowRoot.querySelectorAll("[data-variant]");
    expect(selects[0].value).toBe("38");
    expect(selects[1].value).toBe("Red");
    widget.shadowRoot.querySelector("[data-add]").click();
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      productId: "product-38",
      size: "38",
      color: "Red",
      quantity: 1,
    });
  });

  it("ignores selected variants that are not in the allowlisted options", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);

    const answer = widget.normalizeAnswer({
      output: {
        message: "Pick",
        products: [{
          id: "product-1",
          name: "Dress",
          sizes: ["34", "36"],
          colors: ["Black"],
          selected_size: "38",
          selected_color: "Red",
        }],
      },
    });

    expect(answer.products[0]).toEqual(expect.objectContaining({
      selectedSize: "",
      selectedColor: "",
    }));
  });

  it("emits the allowlisted response product URL without requiring a browser catalog", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Pick",
      products: [{
        id: "product-1",
        slug: "dress",
        url: "https://www.example.com/dress",
        name: "Dress",
        category: "Dresses",
        price: 100,
      }],
    }];
    const listener = vi.fn();
    widget.addEventListener("promptrails:product-view", listener);
    widget.paintMessages();

    widget.shadowRoot.querySelector("[data-view]").click();

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      detail: {
        productId: "product-1",
        slug: "dress",
        url: "https://www.example.com/dress",
      },
    }));
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

  it("shows customer-safe tool progress and completion copy", async () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute(
      "tool-labels",
      JSON.stringify({ knowledge_search: "Mağaza rehberinde arıyorum…" }),
    );
    document.body.appendChild(widget);
    widget.ready = true;
    let progressText = "";
    let completedText = "";
    widget.runtime = {
      async *sendMessageStream() {
        yield { type: "tool_start", toolCallId: "call-1", toolName: "knowledge_search" };
        progressText = widget.shadowRoot.querySelector(".typing")?.textContent || "";
        yield { type: "tool_end", toolCallId: "call-1", toolName: "knowledge_search" };
        completedText = widget.shadowRoot.querySelector(".typing")?.textContent || "";
        yield { type: "done", output: { message: "Yanıt" } };
      },
    };

    await widget.send("İade süresi nedir?");

    expect(progressText).toContain("Mağaza rehberinde arıyorum…");
    expect(progressText).not.toContain("knowledge_search");
    expect(completedText).toContain("Bilgileri buldum, yanıtınızı hazırlıyorum…");
  });

  it("uses generic copy for unknown tools without exposing their names", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);

    widget.startToolActivity("call-1", "private_internal_tool");

    const activity = widget.shadowRoot.querySelector(".typing");
    expect(activity?.textContent).toContain("İlgili bilgileri kontrol ediyorum…");
    expect(activity?.textContent).not.toContain("private_internal_tool");
  });

  it("closes before product navigation and keeps action labels concise", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    widget.catalog = [{ id: "product-1", slug: "dress", name: "A very long dress name", category: "Dresses", price: 100 }];
    widget.open();
    widget.messages = [{
      role: "assistant",
      text: "Pick",
      products: [{ ...widget.catalog[0], canView: true, viewLabel: widget.labels.view }],
    }];
    widget.paintMessages();

    widget.shadowRoot.querySelector("[data-view]").click();

    expect(widget.shadowRoot.querySelector("[data-view]")?.textContent).toBe("İncele");
    expect(widget.shadowRoot.querySelector(".panel")?.classList.contains("is-open")).toBe(false);
  });

  it("recovers the cart button when the host reports a failure", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    widget.catalog = [{ id: "product-1", slug: "dress", name: "Dress", category: "Dresses", price: 100 }];
    widget.messages = [{ role: "assistant", text: "Pick", products: [{ ...widget.catalog[0], canAdd: true }] }];
    widget.paintMessages();

    const button = widget.shadowRoot.querySelector("[data-add]");
    button.click();
    expect(button.textContent).toBe("Ekleniyor…");

    globalThis.dispatchEvent(
      new globalThis.CustomEvent("promptrails:cart-failed", { detail: { productId: "product-1" } }),
    );
    expect(button.textContent).toBe("Sepete ekle");
    expect(button.disabled).toBe(false);
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
