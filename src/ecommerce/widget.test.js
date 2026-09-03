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
    document.documentElement.style.overflow = "";
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

  it("requires explicit legal consent and persists the accepted version", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("workspace-id", "legal-workspace");
    widget.setAttribute("agent-id", "legal-agent");
    widget.setAttribute("legal-notice", "Devam ederek aydınlatma metnini kabul edersin.");
    widget.setAttribute("legal-url", "https://shop.example.com/privacy");
    widget.setAttribute("legal-link-label", "Aydınlatma metni");
    widget.setAttribute("legal-accept-label", "Kabul et");
    widget.setAttribute("legal-consent-version", "2026-08");
    document.body.appendChild(widget);

    expect(widget.shadowRoot?.querySelector(".composer")).toBeNull();
    expect(widget.shadowRoot?.querySelector(".accept-legal")?.textContent).toBe("Kabul et");
    widget.shadowRoot?.querySelector(".accept-legal")?.click();

    expect(widget.shadowRoot?.querySelector(".composer")).not.toBeNull();
    expect(globalThis.localStorage.getItem(
      "promptrails-shop-widget:legal-workspace:legal-agent:legal-consent:2026-08",
    )).toContain('"version":"2026-08"');
  });

  it("can show a passive legal notice without blocking the composer", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("legal-notice", "Devam ederek {{link}} okuduğunu onaylıyorsun.");
    widget.setAttribute("legal-url", "https://shop.example.com/privacy");
    widget.setAttribute("legal-link-label", "Gizlilik Politikası");
    widget.setAttribute("legal-consent-required", "false");
    widget.setAttribute("ai-disclaimer", "Yanıtlar yapay zekâ tarafından oluşturulur.");
    document.body.appendChild(widget);

    expect(widget.shadowRoot?.querySelector(".composer")).not.toBeNull();
    expect(widget.shadowRoot?.querySelector(".accept-legal")).toBeNull();
    expect(widget.shadowRoot?.querySelector(".legal-summary a")?.textContent)
      .toBe("Gizlilik Politikası");
    expect(widget.shadowRoot?.querySelector(".legal-summary")?.textContent)
      .toContain("Devam ederek Gizlilik Politikası okuduğunu onaylıyorsun.");
    expect(widget.shadowRoot?.querySelector(".legal-summary")?.textContent)
      .toContain("· Yanıtlar yapay zekâ tarafından oluşturulur.");
    expect(widget.shadowRoot?.querySelectorAll(".legal-summary")).toHaveLength(1);
  });

  it("supports a message-style greeting and message launcher icon", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("greeting", "Sana uygun parçaları birlikte bulalım.");
    widget.setAttribute("greeting-mode", "message");
    widget.setAttribute("launcher-icon", "message");
    document.body.appendChild(widget);

    expect(widget.shadowRoot?.querySelector(".welcome-message p")?.textContent)
      .toBe("Sana uygun parçaları birlikte bulalım.");
    expect(widget.shadowRoot?.querySelector(".launcher i svg")).not.toBeNull();
  });

  it("can render a minimal launcher without a mark or subtitle", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("launcher-title", "SUUD ASİSTAN");
    widget.setAttribute("launcher-icon", "message");
    widget.setAttribute("show-launcher-mark", "false");
    widget.setAttribute("show-launcher-subtitle", "false");
    document.body.appendChild(widget);

    expect(widget.shadowRoot?.querySelector(".launcher strong")?.textContent).toBe("SUUD ASİSTAN");
    expect(widget.shadowRoot?.querySelector(".launcher-mark")).toBeNull();
    expect(widget.shadowRoot?.querySelector(".launcher small")).toBeNull();
    expect(widget.shadowRoot?.querySelector(".launcher i svg")).not.toBeNull();
  });

  it("keeps summary product cards compact and opens options from a plus button", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-card-mode", "summary");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Öneri",
      products: [{ id: "product-1", slug: "elbise", name: "Elbise", price: 100, sizes: ["36", "38"], colors: ["Siyah"], canAdd: true }],
    }];
    widget.paintMessages();

    expect(widget.shadowRoot?.querySelector(".variants")).toBeNull();
    expect(widget.shadowRoot?.querySelector("[data-add]")).toBeNull();
    expect(widget.shadowRoot?.querySelector("[data-view]")).not.toBeNull();
    expect(widget.shadowRoot?.querySelector(".recommendations-list")?.classList.contains("is-summary")).toBe(true);
    expect(widget.shadowRoot?.querySelector(".recommendation-actions")).toBeNull();
    widget.shadowRoot?.querySelector("[data-cart-drawer-open]")?.click();
    expect(widget.shadowRoot?.querySelector(".cart-drawer")?.hidden).toBe(false);
    expect(widget.shadowRoot?.querySelector(".cart-drawer [data-add]")).not.toBeNull();
  });

  it("marks long product titles for responsive storefront typography", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-card-mode", "summary");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Öneri",
      products: [{ id: "product-1", name: "Siyah Amora Kontrast Detaylı Uzun Elbise", price: 100 }],
    }];
    widget.paintMessages();

    expect(widget.shadowRoot?.querySelector(".recommendation")?.classList.contains("has-long-title")).toBe(true);
  });

  it("selects an in-stock variant in the product drawer before emitting cart-add", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-card-mode", "summary");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    const answer = widget.normalizeAnswer({ output: { message: "Öneri", products: [{
      id: "product-1", name: "Elbise", price: 100,
      variants: [
        { id: "variant-s", size: "S", color: "Siyah", stock: 2 },
        { id: "variant-m", size: "M", color: "Siyah", stock: 1 },
      ],
    }] } });
    widget.messages = [{ role: "assistant", ...answer }];
    const listener = vi.fn();
    widget.addEventListener("promptrails:cart-add", listener);
    widget.paintMessages();

    widget.shadowRoot.querySelector("[data-cart-drawer-open]").click();
    widget.shadowRoot.querySelector('[data-drawer-option="size"][data-option-value="M"]').click();
    widget.shadowRoot.querySelector(".cart-drawer [data-add]").click();

    expect(listener.mock.calls[0][0].detail).toMatchObject({
      productId: "product-1",
      variantId: "variant-m",
      size: "M",
      color: "Siyah",
      quantity: 1,
    });
  });

  it("does not render a plus or cart action for out-of-stock products", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-card-mode", "summary");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    const answer = widget.normalizeAnswer({ output: { message: "Öneri", products: [{
      id: "product-1", name: "Elbise", price: 100,
      variants: [{ id: "variant-s", size: "S", color: "Siyah", stock: 0 }],
    }] } });
    widget.messages = [{ role: "assistant", ...answer }];
    widget.paintMessages();

    expect(answer.products[0].inStock).toBe(false);
    expect(widget.shadowRoot.querySelector("[data-cart-drawer-open]")).toBeNull();
    expect(widget.shadowRoot.querySelector("[data-add]")).toBeNull();
  });

  it("adds accessible carousel controls when more than one summary product is shown", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-card-mode", "summary");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Öneriler",
      products: [
        { id: "product-1", slug: "elbise", name: "Elbise", price: 100 },
        { id: "product-2", slug: "ceket", name: "Ceket", price: 200 },
      ],
    }];
    widget.paintMessages();

    const controls = widget.shadowRoot?.querySelectorAll("[data-carousel-step]");
    expect(widget.shadowRoot?.querySelector(".recommendations-carousel")).not.toBeNull();
    expect(controls).toHaveLength(2);
    expect(controls?.[0].getAttribute("aria-label")).toBe("Önceki ürünler");
    expect(controls?.[1].getAttribute("aria-label")).toBe("Sonraki ürünler");
  });

  it("locks background scrolling and avoids opening the keyboard on mobile", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);
    const input = widget.shadowRoot.querySelector("textarea");
    const focus = vi.spyOn(input, "focus");

    widget.open();
    await Promise.resolve();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(focus).not.toHaveBeenCalled();

    widget.close();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("preserves inline theme CSS after legal consent rerenders the shell", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("workspace-id", "themed-workspace");
    widget.setAttribute("agent-id", "themed-agent");
    widget.setAttribute("theme-css", ".quick button { border-radius: 0; }");
    widget.setAttribute("legal-notice", "Devam etmek için kabul et.");
    widget.setAttribute("legal-url", "https://shop.example.com/privacy");
    document.body.appendChild(widget);

    expect(widget.shadowRoot?.querySelector("style[data-promptrails-theme]")?.textContent)
      .toContain("border-radius: 0");

    widget.shadowRoot?.querySelector(".accept-legal")?.click();

    expect(widget.shadowRoot?.querySelector(".composer")).not.toBeNull();
    expect(widget.shadowRoot?.querySelector("style[data-promptrails-theme]")?.textContent)
      .toContain("border-radius: 0");
  });

  it("renders color swatches and can hide quantity selection", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("color-picker", "swatches");
    widget.setAttribute("show-quantity", "false");
    document.body.appendChild(widget);
    widget.messages = [{
      role: "assistant",
      text: "Öneri",
      products: [{ id: "product-1", name: "Elbise", price: 100, colors: ["Siyah", "Bordo"] }],
    }];
    widget.paintMessages();

    const swatches = widget.shadowRoot?.querySelectorAll("[data-color-value]");
    expect(swatches).toHaveLength(2);
    expect(widget.shadowRoot?.querySelector('[data-variant="quantity"]')).toBeNull();
    swatches?.[1].click();
    expect(widget.selectedVariants["product-1"].color).toBe("Bordo");
    expect(swatches?.[1].getAttribute("aria-pressed")).toBe("true");
  });

  it("renders feedback controls with line icons instead of emoji", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("api-url", "https://api.example.com");
    widget.setAttribute("agent-id", "agent-1");
    widget.setAttribute("api-key", "browser-key");
    document.body.appendChild(widget);
    widget.messages = [{ role: "assistant", text: "Yanıt", executionId: "execution-1" }];
    widget.paintMessages();

    expect(widget.shadowRoot?.querySelectorAll(".feedback button svg")).toHaveLength(2);
    expect(widget.shadowRoot?.querySelector(".feedback")?.textContent).not.toMatch(/[👍👎]/u);
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

  it("turns an allowlisted WhatsApp URL in assistant text into a safe CTA", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("allowed-action-origins", '["https://api.whatsapp.com"]');
    document.body.appendChild(widget);

    const answer = widget.normalizeAnswer({
      output: {
        message: "Size yardımcı olalım: https://api.whatsapp.com/send?phone=905421257885&text=Bilgi%20Almak%20%C4%B0stiyorum",
      },
    });
    widget.messages = [{ role: "assistant", ...answer }];
    widget.paintMessages();

    const link = widget.shadowRoot.querySelector("[data-action-url]");
    expect(answer.text).toBe("Size yardımcı olalım:");
    expect(link?.textContent).toContain("WhatsApp'tan yaz");
    expect(link?.getAttribute("href")).toBe(
      "https://api.whatsapp.com/send?phone=905421257885&text=Bilgi%20Almak%20%C4%B0stiyorum",
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders standalone structured open actions only for explicitly allowed origins", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("allowed-action-origins", '["https://help.example.com"]');
    document.body.appendChild(widget);

    const answer = widget.normalizeAnswer({
      output: {
        message: "Destek seçenekleri",
        ui: {
          version: "1",
          resources: [],
          actions: [
            { kind: "resource.open", label: "Destek", payload: { url: "https://help.example.com/contact" } },
            { kind: "resource.open", label: "Blocked", payload: { url: "https://evil.example/phish" } },
            { kind: "resource.open", label: "Script", payload: { url: "javascript:alert(1)" } },
          ],
          suggestions: [],
        },
      },
    });

    expect(answer.actions).toEqual([
      { url: "https://help.example.com/contact", label: "Destek" },
    ]);
  });

  it("keeps untrusted URLs as inert text instead of creating navigation", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);

    const answer = widget.normalizeAnswer({
      output: { message: "Buraya tıklayın: https://evil.example/phish" },
    });
    widget.messages = [{ role: "assistant", ...answer }];
    widget.paintMessages();

    expect(answer.text).toContain("https://evil.example/phish");
    expect(widget.shadowRoot.querySelector("[data-action-url]")).toBeNull();
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
          selected_variant_id: "variant-m-black",
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
      variantId: "variant-m-black",
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
        variantId: "variant-38-red",
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
      variantId: "variant-38-red",
      size: "38",
      color: "Red",
      quantity: 1,
    });
  });

  it("renders compare-at pricing, linked titles, and locks single variant options", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("product-source", "response");
    document.body.appendChild(widget);
    const answer = widget.normalizeAnswer({
      output: {
        message: "Pick",
        products: [{
          id: "discounted-product",
          slug: "discounted-dress",
          name: "Discounted Dress",
          category: "Dresses",
          price: 1200,
          sizes: ["38"],
          colors: ["Black"],
          attributes: { compare_at_price: 1500 },
          can_view: true,
        }],
      },
    });
    widget.messages = [{
      role: "assistant",
      text: answer.message,
      products: answer.products,
    }];

    widget.paintMessages();

    expect(widget.shadowRoot?.querySelector(".product-title")?.textContent).toBe("Discounted Dress");
    expect(widget.shadowRoot?.querySelector(".price del")?.textContent).toContain("1.500");
    expect(widget.shadowRoot?.querySelectorAll(".variant-locked")).toHaveLength(2);
    expect(widget.shadowRoot?.querySelectorAll('[data-variant="size"], [data-variant="color"]')).toHaveLength(0);
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

  it("opens the same trusted product from its photo and title", () => {
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
        imageUrl: "https://www.example.com/dress.jpg",
        name: "Dress",
        category: "Dresses",
        price: 100,
      }],
    }];
    const listener = vi.fn();
    widget.addEventListener("promptrails:product-view", listener);
    widget.paintMessages();

    widget.shadowRoot.querySelector(".product-image-link").click();
    widget.shadowRoot.querySelector(".product-title").click();

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, expect.objectContaining({
      detail: {
        productId: "product-1",
        slug: "dress",
        url: "https://www.example.com/dress",
      },
    }));
  });

  it("keeps product photo and title styles separate from action buttons", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    const css = `${widget.styles("#111")}${widget.compactStyles()}`;

    expect(css).toContain(".product-image-link{display:block;grid-column:auto;min-height:0");
    expect(css).toContain(".product-title{display:block;width:100%;min-height:0");
    expect(css).toContain(".recommendation-actions button{grid-column:auto;min-height:34px");
    expect(css).not.toContain(".recommendation button{grid-column:1/-1");
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

  it("hides elapsed wait time by default", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);

    widget.setTyping(true, "Canlı koleksiyonda arıyorum…");

    expect(widget.shadowRoot.querySelector(".typing")?.hidden).toBe(false);
    expect(widget.shadowRoot.querySelector(".typing time")).toBeNull();
    widget.setTyping(false);
  });

  it("shows an elapsed wait timer only when explicitly enabled", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    widget.setAttribute("show-activity-duration", "true");
    document.body.appendChild(widget);

    widget.setTyping(true, "Canlı koleksiyonda arıyorum…");
    widget.activityStartedAt = Date.now() - 5_000;
    widget.updateActivityElapsed();

    expect(widget.shadowRoot.querySelector(".typing")?.hidden).toBe(false);
    expect(widget.shadowRoot.querySelector(".typing time")?.textContent).toBe("5 sn");
    widget.setTyping(false);
  });

  it("uses the composer border as the textarea focus indicator", () => {
    const widget = document.createElement("promptrails-shop-assistant");
    document.body.appendChild(widget);

    const styles = widget.shadowRoot.querySelector("style")?.textContent || "";
    expect(styles).toContain(".composer:focus-within");
    expect(styles).toContain(".composer textarea:focus-visible { outline: none; }");
    expect(styles).not.toContain("button:focus-visible, textarea:focus-visible");
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

    widget.shadowRoot.querySelector(".recommendation-actions [data-view]").click();

    expect(widget.shadowRoot.querySelector(".recommendation-actions [data-view]")?.textContent).toBe("İncele");
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
