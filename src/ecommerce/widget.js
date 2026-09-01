/* global CSS, CustomEvent, HTMLElement, URL, customElements, document, fetch, localStorage, location, navigator, requestAnimationFrame, sessionStorage, window */
import { createBrowserChatRuntime } from "../browser/runtime";
import { normalizeChatUI } from "../ui/protocol";

(() => {
  "use strict";

  if (typeof window === "undefined" || typeof customElements === "undefined") return;

  const TAG = "promptrails-shop-assistant";
  if (customElements.get(TAG)) return;

  const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
  const MAX_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
  const DEFAULT_CONSENT_MAX_AGE_DAYS = 180;
  const MAX_CONSENT_MAX_AGE_DAYS = 365;
  const CHAT_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14v10H9l-4 4V5Z"/></svg>';
  const THUMB_UP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10v10H3V10h4Zm0 9h10.2a2 2 0 0 0 1.9-1.4l1.5-5A2 2 0 0 0 18.7 10H14l.7-3.4A2.2 2.2 0 0 0 12.5 4L7 10v9Z"/></svg>';
  const THUMB_DOWN_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14V4H3v10h4Zm0-9h10.2a2 2 0 0 1 1.9 1.4l1.5 5a2 2 0 0 1-1.9 2.6H14l.7 3.4a2.2 2.2 0 0 1-2.2 2.6L7 14V5Z"/></svg>';
  const slotPosition = ["0 0", "33.333% 0", "66.666% 0", "100% 0", "0 100%", "33.333% 100%", "66.666% 100%", "100% 100%"];
  const safe = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const cleanBase = (value) => String(value ?? "").trim().replace(/\/+$/, "");
  const plainText = (value) => String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const visibleUserText = (value) => {
    const raw = String(value ?? "");
    const customerMessage = raw.match(
      /(?:^|\n)<MUSTERI_MESAJI>\s*\n?([\s\S]*?)\n?<\/MUSTERI_MESAJI>(?:\n|$)/,
    );
    return plainText(customerMessage?.[1] ?? raw);
  };
  const mediaUrl = (value) => {
    try {
      const parsed = new URL(String(value ?? "").trim(), location.href);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : "";
    } catch {
      return "";
    }
  };
  const stringList = (value, fallback) => {
    if (!value) return fallback;
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(plainText).filter(Boolean).slice(0, 5) : fallback;
    } catch {
      return value.split("|").map(plainText).filter(Boolean).slice(0, 5);
    }
  };
  const stringMap = (value) => {
    try {
      const parsed = JSON.parse(value || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
      return Object.fromEntries(Object.entries(parsed).slice(0, 50).map(([key, label]) => [
        plainText(key).slice(0, 120),
        plainText(label).slice(0, 120),
      ]).filter(([key, label]) => key && label));
    } catch {
      return {};
    }
  };
  const stylesheetUrl = (value) => {
    const candidate = String(value ?? "").trim();
    return /^(https?:\/\/|\/|\.\.\/|\.\/)/.test(candidate) ? candidate : "";
  };
  const boundedText = (value, maxLength = 500) => plainText(value).slice(0, maxLength);
  const actionOrigins = (value) => stringList(value, []).map((entry) => {
    try {
      const parsed = new URL(entry, location.href);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.origin : "";
    } catch {
      return "";
    }
  }).filter(Boolean);
  const allowedActionUrl = (value, allowedOrigins = []) => {
    try {
      const parsed = new URL(String(value ?? "").trim(), location.href);
      const developmentHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
      if (parsed.protocol !== "https:" && !developmentHttp) return "";
      if (parsed.origin !== location.origin && !allowedOrigins.includes(parsed.origin)) return "";
      return parsed.href;
    } catch {
      return "";
    }
  };
  const actionLabel = (url, fallback, labels) => {
    const custom = boundedText(fallback, 80);
    if (custom) return custom;
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      if (hostname === "api.whatsapp.com" || hostname === "wa.me") return labels.whatsapp;
    } catch { /* invalid URLs are filtered before labels are derived */ }
    return labels.openLink;
  };
  const extractTextActions = (value, allowedOrigins, labels) => {
    let message = String(value ?? "");
    const actions = [];
    for (const match of message.matchAll(/https?:\/\/[^\s<>"']+/gi)) {
      const raw = match[0];
      const candidate = raw.replace(/[),.;!?]+$/, "");
      const url = allowedActionUrl(candidate, allowedOrigins);
      if (!url || actions.some((action) => action.url === url)) continue;
      actions.push({ url, label: actionLabel(url, "", labels) });
      message = message.replace(raw, " ");
      if (actions.length === 3) break;
    }
    return { text: plainText(message), actions };
  };
  const uniqueText = (values, maxItems = 20) => [...new Set((Array.isArray(values) ? values : [])
    .map((value) => boundedText(value, 120))
    .filter(Boolean))].slice(0, maxItems);
  const finiteNumber = (...values) => {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number) && number >= 0) return number;
    }
    return 0;
  };
  const colorSwatch = (value) => {
    const color = boundedText(value, 40).toLocaleLowerCase("tr-TR");
    const palette = {
      siyah: "#111111", black: "#111111", beyaz: "#ffffff", white: "#ffffff",
      ekru: "#f3eee2", krem: "#eee5d5", cream: "#eee5d5", bej: "#d8c3a5", beige: "#d8c3a5",
      bordo: "#6d1f2a", burgundy: "#6d1f2a", kırmızı: "#b3262d", red: "#b3262d",
      lacivert: "#17213c", navy: "#17213c", mavi: "#315b89", blue: "#315b89",
      yeşil: "#48624b", green: "#48624b", haki: "#656947", khaki: "#656947",
      gri: "#8b8b88", gray: "#8b8b88", grey: "#8b8b88", kahverengi: "#694d3a", brown: "#694d3a",
      camel: "#b98c5d", pembe: "#d89aaa", pink: "#d89aaa", mor: "#74557d", purple: "#74557d",
      turuncu: "#c96a32", orange: "#c96a32", sarı: "#d7b642", yellow: "#d7b642",
      altın: "#b99a4a", gold: "#b99a4a", gümüş: "#b8babd", silver: "#b8babd",
    };
    return /^#[\da-f]{3,8}$/i.test(color) ? color : palette[color] || "#c9c5bd";
  };
  const firstImageUrl = (value) => {
    const images = Array.isArray(value) ? value : value ? [value] : [];
    for (const image of images) {
      const candidate = typeof image === "string" ? image : image?.url ?? image?.src ?? image?.image_url;
      const normalized = mediaUrl(candidate);
      if (normalized) return normalized;
    }
    return "";
  };
  const responseProduct = (entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const attributes = entry.attributes && typeof entry.attributes === "object" && !Array.isArray(entry.attributes)
      ? { ...entry, ...entry.attributes }
      : entry;
    const id = boundedText(attributes.id ?? attributes.product_id ?? attributes.urun_id, 160);
    const name = boundedText(attributes.name ?? attributes.title ?? attributes.product_name ?? attributes.urun_adi, 240);
    if (!id || !name) return null;
    const categoryValue = attributes.category ?? attributes.kategori;
    const category = boundedText(
      typeof categoryValue === "object" ? categoryValue?.name ?? categoryValue?.title : categoryValue,
      160,
    );
    const priceValue = attributes.price ?? attributes.fiyat;
    const price = finiteNumber(
      typeof priceValue === "object" ? priceValue?.min : priceValue,
      priceValue?.amount,
      priceValue?.value,
      attributes.sale_price,
    );
    const variants = Array.isArray(attributes.variants) ? attributes.variants : [];
    const sizes = uniqueText([
      ...(Array.isArray(attributes.sizes) ? attributes.sizes : []),
      ...variants.map((variant) => variant?.size).filter(Boolean),
    ]);
    const colors = uniqueText([
      ...(Array.isArray(attributes.colors) ? attributes.colors : []),
      ...variants.map((variant) => variant?.color).filter(Boolean),
    ]);
    const requestedSize = boundedText(attributes.selected_size ?? attributes.selectedSize, 120);
    const requestedColor = boundedText(attributes.selected_color ?? attributes.selectedColor, 120);
    const selectedSize = sizes.includes(requestedSize) ? requestedSize : "";
    const selectedColor = colors.includes(requestedColor) ? requestedColor : "";
    const variantId = boundedText(
      attributes.selected_variant_id ?? attributes.selectedVariantId ?? attributes.variant_id ?? attributes.variantId,
      160,
    );
    const selectedVariant = variants.find((variant) => {
      const candidateID = boundedText(variant?.id ?? variant?.variant_id, 160);
      if (variantId && candidateID === variantId) return true;
      const sizeMatches = !selectedSize || boundedText(variant?.size, 120) === selectedSize;
      const colorMatches = !selectedColor || boundedText(variant?.color, 120) === selectedColor;
      return sizeMatches && colorMatches;
    });
    const compareAtValue = attributes.compare_at_price ?? attributes.compareAtPrice
      ?? attributes.compare_at ?? attributes.compareAt ?? attributes.original_price
      ?? attributes.originalPrice ?? attributes.list_price ?? attributes.listPrice;
    const variantCompareAt = selectedVariant?.price?.compare_at ?? selectedVariant?.price?.compareAt
      ?? selectedVariant?.compare_at ?? selectedVariant?.compareAt;
    const compareAt = finiteNumber(
      typeof compareAtValue === "object" ? compareAtValue?.min : compareAtValue,
      compareAtValue?.amount,
      compareAtValue?.value,
      variantCompareAt,
    );
    const url = mediaUrl(attributes.url ?? attributes.product_url ?? attributes.link);
    return {
      id,
      slug: boundedText(attributes.slug, 200) || id,
      url,
      name,
      category,
      description: boundedText(attributes.description ?? attributes.aciklama, 800),
      price,
      compareAt: compareAt > price ? compareAt : 0,
      imageUrl: firstImageUrl(attributes.imageUrl ?? attributes.image_url ?? attributes.image ?? attributes.images),
      sizes,
      colors,
      selectedSize,
      selectedColor,
      variantId,
    };
  };

  class PromptRailsShopAssistant extends HTMLElement {
    static get observedAttributes() { return ["api-url", "workspace-id", "agent-id", "api-key", "catalog-url", "product-source", "brand", "assistant-name", "assistant-mark", "launcher-title", "launcher-subtitle", "launcher-icon", "greeting", "greeting-mode", "placeholder", "quick-prompts", "accent-color", "currency", "locale", "stylesheet-url", "theme-css", "style-nonce", "persist-session", "session-max-age", "show-tool-activity", "show-activity-duration", "show-quantity", "color-picker", "tool-labels", "allowed-action-origins", "close-on-product-view", "legal-notice", "legal-url", "legal-link-label", "legal-accept-label", "legal-consent-required", "legal-consent-version", "legal-consent-max-age", "ai-disclaimer", "translations"];
    }

    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
      this.catalog = [];
      this.messages = [];
      this.runtime = null;
      this.context = {};
      this.hydrationPromise = Promise.resolve();
      this.opened = false;
      this.busy = false;
      this.ready = false;
      this.activeTools = new Map();
      this.cartTimers = new Map();
      this.activityStartedAt = 0;
      this.activityTimer = 0;
      this.onWindowKey = (event) => this.handleWindowKey(event);
      this.onCartConfirmed = (event) => this.cartConfirmed(event);
      this.onCartFailed = (event) => this.cartFailed(event);
      this.onConnectivity = () => {
        const offline = this.root.querySelector(".offline");
        if (offline) offline.hidden = navigator.onLine;
      };
    }

    connectedCallback() {
      this.createRuntime();
      this.renderShell();
      this.bind();
      this.restore();
      this.hydrationPromise = this.hydrateSession();
      (this.config.productSource === "response" ? Promise.resolve() : this.loadCatalog())
        .finally(() => { this.ready = true; });
      window.addEventListener("keydown", this.onWindowKey);
      window.addEventListener("promptrails:cart-confirmed", this.onCartConfirmed);
      window.addEventListener("promptrails:cart-failed", this.onCartFailed);
      window.addEventListener("online", this.onConnectivity);
      window.addEventListener("offline", this.onConnectivity);
    }

    disconnectedCallback() {
      window.removeEventListener("keydown", this.onWindowKey);
      window.removeEventListener("promptrails:cart-confirmed", this.onCartConfirmed);
      window.removeEventListener("promptrails:cart-failed", this.onCartFailed);
      window.removeEventListener("online", this.onConnectivity);
      window.removeEventListener("offline", this.onConnectivity);
      this.cartTimers.forEach((timer) => window.clearTimeout(timer));
      this.cartTimers.clear();
      window.clearInterval(this.activityTimer);
      if (typeof this.runtime?.disconnect === "function") this.runtime.disconnect();
    }

    attributeChangedCallback(name) {
      if (!this.isConnected) return;
      if (["api-url", "workspace-id", "agent-id", "api-key", "persist-session", "session-max-age"].includes(name)) {
        if (typeof this.runtime?.disconnect === "function") this.runtime.disconnect();
        this.createRuntime();
        this.hydrationPromise = this.hydrateSession();
      }
      this.renderShell();
    }

    get config() {
      const requestedSessionMaxAge = Number(this.getAttribute("session-max-age"));
      const sessionMaxAgeSeconds = Number.isFinite(requestedSessionMaxAge) && requestedSessionMaxAge > 0
        ? Math.min(Math.floor(requestedSessionMaxAge), MAX_SESSION_MAX_AGE_SECONDS)
        : DEFAULT_SESSION_MAX_AGE_SECONDS;
      const requestedConsentMaxAge = Number(this.getAttribute("legal-consent-max-age"));
      const consentMaxAgeDays = Number.isFinite(requestedConsentMaxAge) && requestedConsentMaxAge > 0
        ? Math.min(Math.floor(requestedConsentMaxAge), MAX_CONSENT_MAX_AGE_DAYS)
        : DEFAULT_CONSENT_MAX_AGE_DAYS;
      const brand = this.getAttribute("brand")?.trim() || "Mağaza";
      return {
        apiUrl: cleanBase(this.getAttribute("api-url")),
        workspaceId: this.getAttribute("workspace-id")?.trim() ?? "",
        agentId: this.getAttribute("agent-id")?.trim() ?? "",
        apiKey: this.getAttribute("api-key")?.trim() ?? "",
        catalogUrl: this.getAttribute("catalog-url")?.trim() || "/api/katalog",
        productSource: this.getAttribute("product-source") === "response" ? "response" : "catalog",
        brand,
        assistantName: this.getAttribute("assistant-name")?.trim() || `${brand} Stil Danışmanı`,
        assistantMark: plainText(this.getAttribute("assistant-mark") || brand).slice(0, 2).toLocaleUpperCase("tr-TR") || "AI",
        launcherTitle: this.getAttribute("launcher-title")?.trim() || "Stil danışmanı",
        launcherSubtitle: this.getAttribute("launcher-subtitle")?.trim() || "Size özel öneriler",
        launcherIcon: this.getAttribute("launcher-icon") === "message" ? "message" : "arrow",
        greeting: this.getAttribute("greeting")?.trim() || "Merhaba, size nasıl yardımcı olabilirim?",
        greetingMode: this.getAttribute("greeting-mode") === "message" ? "message" : "welcome",
        placeholder: this.getAttribute("placeholder")?.trim() || "Nasıl bir parça arıyorsunuz?",
        quickPrompts: stringList(this.getAttribute("quick-prompts"), ["Günlük şık bir görünüm", "Bir davet için elbise", "Bütçeme göre öner"]),
        accent: this.getAttribute("accent-color")?.trim() || "#121212",
        currency: this.getAttribute("currency")?.trim().toLocaleUpperCase() || "TRY",
        locale: this.getAttribute("locale")?.trim() || "tr-TR",
        stylesheetUrl: stylesheetUrl(this.getAttribute("stylesheet-url")),
        themeCss: this.getAttribute("theme-css") || "",
        styleNonce: this.getAttribute("style-nonce")?.trim() || "",
        persistSession: this.getAttribute("persist-session") !== "false",
        sessionMaxAgeMs: sessionMaxAgeSeconds * 1000,
        showToolActivity: this.getAttribute("show-tool-activity") !== "false",
        showActivityDuration: this.getAttribute("show-activity-duration") === "true",
        showQuantity: this.getAttribute("show-quantity") !== "false",
        colorPicker: this.getAttribute("color-picker") === "swatches" ? "swatches" : "select",
        toolLabels: stringMap(this.getAttribute("tool-labels")),
        allowedActionOrigins: actionOrigins(this.getAttribute("allowed-action-origins")),
        closeOnProductView: this.getAttribute("close-on-product-view") !== "false",
        legalNotice: boundedText(this.getAttribute("legal-notice"), 500),
        legalUrl: mediaUrl(this.getAttribute("legal-url")),
        legalLinkLabel: boundedText(this.getAttribute("legal-link-label"), 120),
        legalAcceptLabel: boundedText(this.getAttribute("legal-accept-label"), 80),
        legalConsentRequired: this.getAttribute("legal-consent-required") !== "false",
        legalConsentVersion: boundedText(this.getAttribute("legal-consent-version"), 80) || "1",
        legalConsentMaxAgeSeconds: consentMaxAgeDays * 24 * 60 * 60,
        aiDisclaimer: boundedText(this.getAttribute("ai-disclaimer"), 300),
      };
    }

    get labels() {
      const english = {
        open: "Open chat", close: "Minimize chat", newChat: "Start a new chat", online: "Online",
        welcomeTitle: "Let's find it together.", message: "Your message", send: "Send message",
        thinking: "is reviewing options", poweredBy: "Powered by PromptRails", demo: "Demo mode",
        view: "View", add: "Add to cart", adding: "Adding…", added: "Added ✓", cartFailed: "Try again",
        size: "Size", color: "Color", quantity: "Quantity", shipping: "Shipment", order: "Order",
        feedback: "Was this helpful?", helpful: "Helpful", notHelpful: "Not helpful",
        offline: "You are offline. Check your connection.", retry: "Try again",
        toolWorking: "Checking the relevant information…", toolComplete: "Information found. Preparing your answer…",
        openLink: "Open link", whatsapp: "Message on WhatsApp", accept: "Accept", privacyPolicy: "Privacy policy",
      };
      const turkish = {
        open: "Sohbeti aç", close: "Sohbeti küçült", newChat: "Yeni sohbet başlat", online: "Çevrimiçi",
        welcomeTitle: "Birlikte bulalım.", message: "Mesajınız", send: "Mesajı gönder",
        thinking: "seçkiyi inceliyor", poweredBy: "PromptRails ile çalışır", demo: "Demo modu",
        view: "İncele", add: "Sepete ekle", adding: "Ekleniyor…", added: "Sepete eklendi ✓", cartFailed: "Tekrar dene",
        size: "Beden", color: "Renk", quantity: "Adet", shipping: "Kargo takibi", order: "Sipariş",
        feedback: "Bu öneri yardımcı oldu mu?", helpful: "Yardımcı oldu", notHelpful: "Yardımcı olmadı",
        offline: "Çevrimdışısınız. Bağlantınızı kontrol edin.", retry: "Tekrar deneyelim",
        toolWorking: "İlgili bilgileri kontrol ediyorum…", toolComplete: "Bilgileri buldum, yanıtınızı hazırlıyorum…",
        openLink: "Bağlantıyı aç", whatsapp: "WhatsApp'tan yaz", accept: "Kabul et", privacyPolicy: "Gizlilik politikası",
      };
      let custom = {};
      try { custom = JSON.parse(this.getAttribute("translations") || "{}"); } catch { /* invalid overrides are ignored */ }
      return { ...(this.config.locale.toLowerCase().startsWith("tr") ? turkish : english), ...custom };
    }

    createRuntime() {
      if (!this.configured) return;
      this.migrateLegacySession();
      this.runtime = createBrowserChatRuntime({
        apiKey: this.config.apiKey,
        agentId: this.config.agentId,
        baseUrl: this.config.apiUrl,
        workspaceId: this.config.workspaceId,
        title: `${this.config.brand} web store`,
        metadata: { channel: "ecommerce_widget" },
        persistSession: this.config.persistSession,
        sessionMaxAge: Math.floor(this.config.sessionMaxAgeMs / 1000),
        storageKey: `${this.storageKey}:session`,
        onEvent: (event) => this.emit("promptrails:runtime", event),
      });
    }

    get configured() {
      const { apiUrl, agentId, apiKey } = this.config;
      return Boolean(apiUrl && agentId && apiKey && !apiKey.startsWith("your_"));
    }

    get storageKey() {
      const { workspaceId, agentId } = this.config;
      return `promptrails-shop-widget:${workspaceId || "demo"}:${agentId || "local"}`;
    }

    get consentStorageKey() {
      return `${this.storageKey}:legal-consent:${this.config.legalConsentVersion}`;
    }

    get consentCookieName() {
      return `${this.storageKey}:legal-consent`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
    }

    get consentRequired() {
      return Boolean(this.config.legalConsentRequired && this.config.legalNotice && this.config.legalUrl);
    }

    hasLegalConsent() {
      if (!this.consentRequired) return true;
      try {
        const saved = JSON.parse(localStorage.getItem(this.consentStorageKey) || "null");
        if (saved?.version === this.config.legalConsentVersion && Number(saved?.acceptedAt) > 0) return true;
      } catch { /* local storage is optional */ }
      try {
        const expected = encodeURIComponent(this.config.legalConsentVersion);
        return document.cookie.split(";").some((entry) => entry.trim() === `${this.consentCookieName}=${expected}`);
      } catch { return false; }
    }

    acceptLegalConsent() {
      const acceptedAt = Date.now();
      try {
        localStorage.setItem(this.consentStorageKey, JSON.stringify({
          acceptedAt,
          version: this.config.legalConsentVersion,
        }));
      } catch { /* cookie remains available as a fallback */ }
      try {
        const secure = location.protocol === "https:" ? "; Secure" : "";
        document.cookie = `${this.consentCookieName}=${encodeURIComponent(this.config.legalConsentVersion)}; Path=/; Max-Age=${this.config.legalConsentMaxAgeSeconds}; SameSite=Lax${secure}`;
      } catch { /* local storage remains available as a fallback */ }
      this.renderShell();
      requestAnimationFrame(() => this.root.querySelector("textarea")?.focus());
      this.emit("promptrails:legal-consent", { acceptedAt, version: this.config.legalConsentVersion });
    }

    renderShell() {
      const { assistantName, assistantMark, launcherTitle, launcherSubtitle, launcherIcon, greeting, greetingMode, placeholder, quickPrompts, accent, stylesheetUrl: customStylesheet, styleNonce, legalNotice, legalUrl, legalLinkLabel, legalAcceptLabel, aiDisclaimer } = this.config;
      const labels = this.labels;
      const consented = this.hasLegalConsent();
      const legalLink = legalUrl ? `<a href="${safe(legalUrl)}" target="_blank" rel="noopener noreferrer">${safe(legalLinkLabel || labels.privacyPolicy)}</a>` : "";
      const legalText = legalNotice && legalLink
        ? safe(legalNotice).includes("{{link}}")
          ? safe(legalNotice).replace("{{link}}", legalLink)
          : `${safe(legalNotice)} ${legalLink}`
        : "";
      this.root.innerHTML = `<style${styleNonce ? ` nonce="${safe(styleNonce)}"` : ""}>${this.styles(accent)}${this.compactStyles()}</style>${customStylesheet ? `<link rel="stylesheet" href="${safe(customStylesheet)}">` : ""}
        <button class="launcher" part="launcher" type="button" aria-label="${safe(labels.open)}" aria-expanded="${this.opened}" aria-controls="pt-shop-panel" ${this.opened ? "hidden" : ""}>
          <span class="launcher-mark">${safe(assistantMark)}</span><span><strong>${safe(launcherTitle)}</strong><small>${safe(launcherSubtitle)}</small></span><i aria-hidden="true">${launcherIcon === "message" ? CHAT_ICON : "↗"}</i>
        </button>
        <section id="pt-shop-panel" class="panel ${this.opened ? "is-open" : ""}" part="panel" role="dialog" aria-modal="false" aria-label="${safe(assistantName)}" aria-hidden="${!this.opened}">
          <header part="header"><div><span class="avatar">${safe(assistantMark)}</span><p><strong>${safe(assistantName)}</strong><small><i></i> ${safe(labels.online)}</small></p></div><div class="panel-actions"><button class="new-chat" type="button" aria-label="${safe(labels.newChat)}" title="${safe(labels.newChat)}">＋</button><button class="close" type="button" aria-label="${safe(labels.close)}">×</button></div></header>
          <div class="conversation" role="log" aria-live="polite" part="messages">
            ${greetingMode === "message" ? `<div class="welcome welcome-message message assistant"><span class="mini-avatar">${safe(assistantMark)}</span><div><p>${safe(greeting)}</p></div></div>` : `<div class="welcome"><span class="welcome-mark">${safe(assistantMark)}</span><h2>${safe(labels.welcomeTitle)}</h2><p>${safe(greeting)}</p></div>`}
            <div class="quick initial">${quickPrompts.map((prompt) => `<button type="button">${safe(prompt)}</button>`).join("")}</div>
            <div class="messages"></div>
            <div class="offline" ${navigator.onLine ? "hidden" : ""}>${safe(labels.offline)}</div>
            <div class="typing" part="activity" role="status" aria-live="polite" hidden><span></span><span></span><span></span><em>${safe(assistantName)} ${safe(labels.thinking)}</em>${this.config.showActivityDuration ? "<time>0 sn</time>" : ""}</div>
          </div>
          ${consented ? `<form class="composer" part="composer"><label class="sr-only" for="pt-message">${safe(labels.message)}</label><textarea id="pt-message" rows="1" maxlength="800" placeholder="${safe(placeholder)}"></textarea><button type="submit" aria-label="${safe(labels.send)}">↑</button></form>${legalText && !this.consentRequired ? `<p class="legal-inline" part="legal-notice">${legalText}</p>` : ""}` : `<aside class="legal-consent" part="legal-consent" role="note"><p>${legalText}</p><button class="accept-legal" type="button">${safe(legalAcceptLabel || labels.accept)}</button></aside>`}
          ${aiDisclaimer ? `<p class="ai-disclaimer" part="ai-disclaimer">${safe(aiDisclaimer)}</p>` : ""}
          <footer part="footer"><span>✦</span> ${safe(labels.poweredBy)}${this.configured ? "" : ` · ${safe(labels.demo)}`}</footer>
        </section>`;
      this.applyThemeCss();
      this.paintMessages();
      this.bind();
    }

    applyThemeCss() {
      const { themeCss, styleNonce } = this.config;
      if (!themeCss) return;
      const style = document.createElement("style");
      style.dataset.promptrailsTheme = "true";
      if (styleNonce) style.setAttribute("nonce", styleNonce);
      style.textContent = themeCss;
      this.root.append(style);
    }

    bind() {
      const launcher = this.root.querySelector(".launcher");
      const close = this.root.querySelector(".close");
      const newChat = this.root.querySelector(".new-chat");
      const form = this.root.querySelector(".composer");
      const acceptLegal = this.root.querySelector(".accept-legal");
      if (launcher) launcher.onclick = () => this.toggle(!this.opened);
      if (close) close.onclick = () => this.toggle(false);
      if (newChat) newChat.onclick = () => this.startNewSession();
      if (acceptLegal) acceptLegal.onclick = () => this.acceptLegalConsent();
      if (form) form.onsubmit = (event) => {
        event.preventDefault();
        const input = this.root.querySelector("textarea");
        const content = input.value.trim();
        if (!content || this.busy) return;
        input.value = "";
        this.send(content);
      };
      const textarea = this.root.querySelector("textarea");
      if (textarea) textarea.onkeydown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form?.requestSubmit(); }
      };
      this.root.querySelectorAll(".initial button").forEach((button) => { button.onclick = () => this.send(button.textContent); });
      this.root.querySelectorAll("[data-quick]").forEach((button) => { button.onclick = () => this.send(button.dataset.quick); });
      this.root.querySelectorAll("[data-view]").forEach((button) => { button.onclick = () => {
        if (this.config.closeOnProductView) this.toggle(false);
        const product = this.findProduct(button.dataset.productId);
        this.emit("promptrails:product-view", {
          slug: button.dataset.view,
          productId: button.dataset.productId,
          ...(product?.url ? { url: product.url } : {}),
        });
      }; });
      this.root.querySelectorAll("[data-add]").forEach((button) => { button.onclick = () => {
        const product = this.findProduct(button.dataset.add);
        if (!product) return;
        button.disabled = true;
        button.dataset.idleLabel = button.textContent || this.labels.add;
        button.textContent = this.labels.adding;
        const selected = this.selectedVariants?.[product.id] || {};
        this.emit("promptrails:cart-add", { productId: product.id, variantId: product.variantId || undefined, slug: product.slug, size: selected.size || product.selectedSize || product.sizes?.[0], color: selected.color || product.selectedColor || product.colors?.[0], quantity: Number(selected.quantity) || 1 });
        window.clearTimeout(this.cartTimers.get(product.id));
        this.cartTimers.set(product.id, window.setTimeout(() => {
          this.cartFailed({ detail: { productId: product.id } });
          this.emit("promptrails:error", { code: "cart_confirmation_timeout", productId: product.id });
        }, 10_000));
      }; });
      this.root.querySelectorAll("[data-variant]").forEach((select) => {
        const product = this.findProduct(select.dataset.productId);
        const initialValue = select.dataset.variant === "size"
          ? product?.selectedSize
          : select.dataset.variant === "color"
            ? product?.selectedColor
            : "";
        if (initialValue && [...select.options].some((option) => option.value === initialValue)) {
          select.value = initialValue;
          this.selectedVariants ||= {};
          this.selectedVariants[select.dataset.productId] ||= {};
          this.selectedVariants[select.dataset.productId][select.dataset.variant] = initialValue;
        }
        select.onchange = () => {
          this.selectedVariants ||= {};
          this.selectedVariants[select.dataset.productId] ||= {};
          this.selectedVariants[select.dataset.productId][select.dataset.variant] = select.value;
        };
      });
      this.root.querySelectorAll("[data-color-value]").forEach((button) => {
        button.onclick = () => {
          const productId = button.dataset.productId;
          this.selectedVariants ||= {};
          this.selectedVariants[productId] ||= {};
          this.selectedVariants[productId].color = button.dataset.colorValue;
          button.parentElement?.querySelectorAll("[data-color-value]").forEach((item) => {
            item.setAttribute("aria-pressed", String(item === button));
          });
          const value = button.closest("label")?.querySelector(".swatch-value");
          if (value) value.textContent = button.dataset.colorValue;
        };
      });
      this.root.querySelectorAll("[data-feedback]").forEach((button) => {
        button.onclick = () => this.submitFeedback(Number(button.dataset.messageIndex), Number(button.dataset.feedback));
      });
      this.root.querySelectorAll("[data-action-url]").forEach((link) => {
        link.onclick = () => this.emit("promptrails:action-open", {
          url: link.href,
          label: link.textContent?.trim() || "",
        });
      });
    }

    toggle(next) {
      this.opened = next;
      this.root.querySelector(".panel")?.classList.toggle("is-open", next);
      this.root.querySelector(".panel")?.setAttribute("aria-hidden", String(!next));
      const launcher = this.root.querySelector(".launcher");
      launcher?.setAttribute("aria-expanded", String(next));
      if (launcher) launcher.hidden = next;
      if (next) requestAnimationFrame(() => (this.root.querySelector("textarea") || this.root.querySelector(".accept-legal"))?.focus());
      this.emit(next ? "promptrails:open" : "promptrails:close", {});
    }

    open() { this.toggle(true); }
    close() { this.toggle(false); }
    newSession() { return this.startNewSession(); }
    updateContext(context = {}) { this.context = { ...this.context, ...context }; }
    destroy() { this.remove(); }

    handleWindowKey(event) {
      if (event.key === "Escape" && this.opened) { event.preventDefault(); this.toggle(false); return; }
      if (!this.opened || event.key !== "Tab") return;
      const focusable = [...this.root.querySelectorAll('button:not([disabled]), textarea:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && this.root.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && this.root.activeElement === last) { event.preventDefault(); first.focus(); }
    }

    emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    async startNewSession() {
      this.messages = [];
      try {
        localStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.storageKey);
      } catch { /* storage is optional */ }
      await this.runtime?.newSession();
      this.paintMessages();
      this.root.querySelector("textarea")?.focus();
      this.emit("promptrails:session-new", {});
    }

    async loadCatalog() {
      try {
        const response = await fetch(this.config.catalogUrl, { headers: { Accept: "application/json" }, credentials: "same-origin" });
        if (!response.ok) throw new Error("Katalog yüklenemedi");
        const body = await response.json();
        this.catalog = Array.isArray(body.products) ? body.products : Array.isArray(body.data?.products) ? body.data.products : [];
      } catch {
        this.catalog = [];
      }
    }

    findProduct(id) {
      const expected = String(id ?? "");
      return this.catalog.find((item) => String(item.id) === expected)
        || this.messages.flatMap((message) => message.products || []).find((item) => String(item.id) === expected);
    }

    restore() {
      if (!this.config.persistSession) return;
      try {
        const serialized = localStorage.getItem(this.storageKey) || sessionStorage.getItem(this.storageKey) || "{}";
        const saved = JSON.parse(serialized);
        const lastActivityAt = Number(saved.lastActivityAt);
        const age = Date.now() - lastActivityAt;
        if (!Number.isFinite(lastActivityAt) || age < 0 || age > this.config.sessionMaxAgeMs) {
          localStorage.removeItem(this.storageKey);
          sessionStorage.removeItem(this.storageKey);
          return;
        }
        this.messages = Array.isArray(saved.messages)
          ? saved.messages.slice(-20).map((message) =>
            message?.role === "user" ? { ...message, text: visibleUserText(message.text) } : message,
          )
          : [];
        localStorage.setItem(this.storageKey, JSON.stringify({ messages: this.messages, lastActivityAt }));
        sessionStorage.removeItem(this.storageKey);
        this.paintMessages();
      } catch { /* private-mode storage can be unavailable */ }
    }

    persist() {
      if (!this.config.persistSession) return;
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          messages: this.messages.slice(-20),
          lastActivityAt: Date.now(),
        }));
      } catch { /* optional persistence */ }
    }

    migrateLegacySession() {
      if (!this.config.persistSession) return;
      try {
        const raw = localStorage.getItem(this.storageKey) || sessionStorage.getItem(this.storageKey);
        if (!raw || localStorage.getItem(`${this.storageKey}:session`)) return;
        const saved = JSON.parse(raw);
        const sessionId = typeof saved.chatId === "string" ? saved.chatId : saved.sessionId;
        if (/^[0-9A-Za-z]{27}$/.test(sessionId || "") && typeof saved.resumeToken === "string" && saved.resumeToken.length >= 32) {
          localStorage.setItem(`${this.storageKey}:session`, JSON.stringify({ sessionId, resumeToken: saved.resumeToken, lastActivityAt: Number(saved.lastActivityAt) || Date.now() }));
        }
      } catch { /* optional migration */ }
    }

    async hydrateSession() {
      if (!this.runtime) return;
      try {
        const rows = await this.runtime.hydrate();
        if (!rows.length) {
          this.persist();
          return;
        }
        this.messages = rows.filter((row) => row?.role === "user" || row?.role === "assistant").map((row) => {
          if (row.role === "user") return { role: "user", text: visibleUserText(row.content) };
          return { role: "assistant", ...this.normalizeAnswer({ output: row.content, executionId: row.executionId || row.metadata?.execution_id }) };
        }).slice(-20);
        this.persist();
        this.paintMessages();
      } catch { /* unavailable history starts fresh */ }
    }

    async send(content) {
      this.toggle(true);
      if (!navigator.onLine) {
        this.emit("promptrails:error", { code: "offline" });
        return;
      }
      if (!this.ready) await this.loadCatalog();
      await this.hydrationPromise;
      this.messages.push({ role: "user", text: content });
      this.busy = true;
      this.activeTools.clear();
      this.paintMessages();
      this.setTyping(true);
      try {
        const result = this.runtime ? await this.askPromptRails(content) : await this.localAnswer(content);
        this.messages.push({ role: "assistant", ...result });
      } catch (error) {
        this.messages.push({ role: "assistant", text: this.errorMessage(error), products: [], quickReplies: [this.labels.retry] });
      } finally {
        this.busy = false;
        this.activeTools.clear();
        this.setTyping(false);
        this.persist();
        this.paintMessages();
      }
    }

    async askPromptRails(customerMessage) {
      if (!this.runtime) throw new Error("Chat runtime is not configured.");
      const pageContext = typeof this.contextProvider === "function" ? await this.contextProvider() : {};
      const context = { title: document.title, path: location.pathname, ...pageContext, ...this.context };
      let finalOutput;
      let ui;
      let executionId = "";
      try {
        for await (const event of this.runtime.sendMessageStream({ content: customerMessage, context })) {
          if (event.type === "error") throw new Error(event.error || "Agent could not respond.");
          if (event.type === "execution") executionId = event.executionId || "";
          if (event.type === "tool_start") this.startToolActivity(event.toolCallId, event.toolName);
          if (event.type === "tool_end") this.endToolActivity(event.toolCallId, event.toolName);
          if (event.type === "ui") ui = event.ui;
          if (event.type === "done") finalOutput = event.output;
        }
        if (finalOutput === undefined) throw new Error("Agent response did not complete.");
        return this.normalizeAnswer({ output: finalOutput, ui, executionId });
      } catch (error) {
        if (error?.status !== 403) throw error;
        await this.runtime.newSession();
        return this.askPromptRails(customerMessage);
      }
    }

    normalizeAnswer(result) {
      let value = result?.output ?? result;
      if (value && typeof value === "object" && "content" in value) value = value.content;
      if (value && typeof value === "object" && "output" in value) value = value.output;
      if (typeof value === "string") {
        const candidate = value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
        try { value = JSON.parse(candidate); } catch { value = { message: plainText(value) }; }
      }
      if (!value || typeof value !== "object") value = { message: plainText(value) };
      const genericUI = normalizeChatUI(result?.ui) || normalizeChatUI(value.ui);
      const resources = genericUI ? genericUI.resources.filter((resource) => resource.kind === "product") : [];
      const statusCards = genericUI ? genericUI.resources.filter((resource) => ["order", "order_tracking", "status"].includes(resource.kind)).map((resource) => ({ id: resource.id, kind: resource.kind, ...resource.attributes })).slice(0, 3) : [];
      const requested = resources.length ? resources : Array.isArray(value.products) ? value.products : Array.isArray(value.urunler) ? value.urunler : [];
      const actions = genericUI?.actions || [];
      const messageWithActions = extractTextActions(
        value.message ?? value.mesaj ?? value.answer ?? "Seçkiden birkaç alternatif hazırladım.",
        this.config.allowedActionOrigins,
        this.labels,
      );
      const standaloneActions = actions.filter((action) => !action.resourceId && action.kind === "resource.open").map((action) => {
        const url = allowedActionUrl(action.payload?.url ?? action.payload?.href, this.config.allowedActionOrigins);
        return url ? { url, label: actionLabel(url, action.label, this.labels) } : null;
      }).filter(Boolean);
      const messageActions = [...standaloneActions, ...messageWithActions.actions]
        .filter((action, index, all) => all.findIndex((candidate) => candidate.url === action.url) === index)
        .slice(0, 3);
      const products = requested.map((entry) => {
        const id = boundedText(typeof entry === "string" ? entry : entry.id ?? entry.product_id, 160);
        const attributes = entry?.attributes && typeof entry.attributes === "object" ? entry.attributes : entry;
        const product = this.config.productSource === "response"
          ? responseProduct(entry)
          : this.catalog.find((item) => String(item.id) === id);
        const resourceActions = actions.filter((action) => String(action.resourceId) === id);
        const viewAction = resourceActions.find((action) => action.kind === "resource.open");
        const addAction = resourceActions.find((action) => action.kind === "cart.add");
        return product ? {
          ...product,
          reason: plainText(attributes.reason ?? attributes.neden ?? "Size uygun bir seçenek."),
          canView: !genericUI || Boolean(viewAction),
          canAdd: !genericUI || Boolean(addAction),
          viewLabel: this.labels.view,
          addLabel: this.labels.add,
        } : null;
      }).filter(Boolean).slice(0, 3);
      return {
        text: messageWithActions.text,
        actions: messageActions,
        products,
        statusCards,
        quickReplies: genericUI
          ? genericUI.suggestions.map((item) => ({ label: plainText(item.label), value: plainText(item.value) })).slice(0, 3)
          : (value.quick_replies ?? value.hizli_yanitlar ?? []).filter((item) => typeof item === "string").slice(0, 3),
        executionId: String(result?.executionId ?? ""),
      };
    }

    async localAnswer(message) {
      const normalized = message.toLocaleLowerCase("tr-TR");
      const budget = Number(normalized.match(/(?:altında|kadar|bütçe.{0,8})([\d.]+)/)?.[1]?.replaceAll(".", ""));
      const words = normalized.replace(/[^a-zçğıöşü0-9 ]/gi, " ").split(/\s+/).filter((word) => word.length > 2);
      let pool = this.catalog;
      if (/elbise/.test(normalized)) pool = pool.filter((product) => /elbise/i.test(product.category));
      else if (/çanta/.test(normalized)) pool = pool.filter((product) => /çanta/i.test(product.category));
      else if (/ayakkabı|ayakkabi|loafer|topuk/.test(normalized)) pool = pool.filter((product) => /ayakkabı/i.test(product.category));
      else if (/palto|trençkot|trenc|blazer|dış giyim/.test(normalized)) pool = pool.filter((product) => /dış giyim/i.test(product.category));
      const ranked = pool.map((product) => {
        const text = [product.name, product.category, product.description, product.material, ...(product.tags || []), ...(product.colors || [])].join(" ").toLocaleLowerCase("tr-TR");
        let score = words.reduce((total, word) => total + (text.includes(word) ? 3 : 0), 0);
        if (/davet|gece|nikah|özel/.test(normalized) && /elbise/.test(text)) score += 8;
        if (/günlük|rahat|ofis/.test(normalized) && /blazer|pantolon|gömlek/.test(text)) score += 6;
        if (/çanta/.test(normalized) && /çanta/.test(text)) score += 9;
        if (budget && product.price > budget) score -= 20;
        return { ...product, score };
      }).filter((product) => !budget || product.price <= budget).sort((a, b) => b.score - a.score || a.price - b.price).slice(0, 3);
      return {
        text: ranked.length ? "Tarzınıza ve ihtiyacınıza uyabilecek bu parçaları seçtim. İlk önerim özellikle dengeli formuyla güçlü bir başlangıç." : "Bu bütçede eşleşen bir parça bulamadım; aralığı biraz genişletmek ister misiniz?",
        products: ranked.map((product) => ({ ...product, reason: /davet/.test(normalized) ? "Zarif silueti davet görünümüne çok uygun." : "Zamansız formu farklı parçalarla kolayca birleşir." })),
        quickReplies: ["Daha sade seçenekler", "Sadece siyah göster", "Beden konusunda yardım"],
      };
    }

    errorMessage(error) {
      const message = error instanceof Error ? error.message : "Bağlantı kurulamadı.";
      if (/origin|cors/i.test(message)) return "Bu mağaza alan adı henüz agent'ın izinli origin listesinde değil. Mağaza yöneticisi PromptRails ayarlarını kontrol etmeli.";
      if (/429|credits|billing|rate limit/i.test(message)) return "Stil danışmanımız şu anda yoğun. Lütfen kısa bir süre sonra yeniden deneyin.";
      return "Şu anda stil danışmanımıza ulaşamıyoruz. Lütfen biraz sonra yeniden deneyin.";
    }

    startToolActivity(id, name) {
      if (!this.config.showToolActivity) return;
      const key = String(id || name || `tool-${this.activeTools.size + 1}`);
      this.activeTools.set(key, String(name || ""));
      this.setTyping(true, this.config.toolLabels[name] || this.labels.toolWorking, "running");
    }

    endToolActivity(id, name) {
      if (!this.config.showToolActivity) return;
      this.activeTools.delete(String(id || name || ""));
      const remaining = [...this.activeTools.values()].at(-1);
      if (remaining !== undefined) {
        this.setTyping(true, this.config.toolLabels[remaining] || this.labels.toolWorking, "running");
        return;
      }
      this.setTyping(true, this.labels.toolComplete, "complete");
    }

    setTyping(visible, text = "", state = "thinking") {
      const element = this.root.querySelector(".typing");
      if (element) {
        if (visible && !this.activityStartedAt) {
          this.activityStartedAt = Date.now();
          if (this.config.showActivityDuration) {
            window.clearInterval(this.activityTimer);
            this.activityTimer = window.setInterval(() => this.updateActivityElapsed(), 1_000);
          }
        }
        if (!visible) {
          window.clearInterval(this.activityTimer);
          this.activityTimer = 0;
          this.activityStartedAt = 0;
        }
        element.hidden = !visible;
        element.classList.toggle("is-finalizing", visible && state === "complete");
        const label = element.querySelector("em");
        if (label) label.textContent = text || `${this.config.assistantName} ${this.labels.thinking}`;
        this.updateActivityElapsed();
      }
      this.scroll();
    }

    updateActivityElapsed() {
      const elapsed = this.root.querySelector(".typing time");
      if (!elapsed || !this.activityStartedAt) return;
      elapsed.textContent = `${Math.max(0, Math.floor((Date.now() - this.activityStartedAt) / 1_000))} sn`;
    }

    cartConfirmed(event) {
      const id = event.detail?.productId;
      window.clearTimeout(this.cartTimers.get(id));
      this.cartTimers.delete(id);
      const button = this.root.querySelector(`[data-add="${CSS.escape(String(id))}"]`);
      if (button) { button.textContent = this.labels.added; button.disabled = false; }
    }

    cartFailed(event) {
      const id = event.detail?.productId;
      window.clearTimeout(this.cartTimers.get(id));
      this.cartTimers.delete(id);
      const button = this.root.querySelector(`[data-add="${CSS.escape(String(id))}"]`);
      if (button) {
        button.textContent = button.dataset.idleLabel || this.labels.cartFailed;
        button.disabled = false;
      }
    }

    async submitFeedback(messageIndex, value) {
      const message = this.messages[messageIndex];
      if (!message?.executionId || !this.runtime || ![-1, 1].includes(value)) return;
      message.feedback = value;
      this.persist();
      this.paintMessages();
      try {
        await this.runtime.submitFeedback(message.executionId, value);
        this.emit("promptrails:feedback", { executionId: message.executionId, value });
      } catch {
        delete message.feedback;
        this.persist();
        this.paintMessages();
      }
    }

    paintMessages() {
      const target = this.root.querySelector(".messages");
      if (!target) return;
      this.root.querySelector(".conversation")?.classList.toggle("has-messages", this.messages.length > 0);
      target.innerHTML = this.messages.map((message, index) => message.role === "user"
        ? `<article class="message user"><p>${safe(message.text)}</p></article>`
        : `<article class="message assistant" part="message assistant-message"><span class="mini-avatar">${safe(this.config.assistantMark)}</span><div><p>${safe(message.text)}</p>${this.actionMarkup(message.actions)}${this.productMarkup(message.products)}${this.statusMarkup(message.statusCards)}${this.quickMarkup(message.quickReplies)}${this.feedbackMarkup(message, index)}</div></article>`).join("");
      this.bind();
      this.scroll(this.messages.at(-1)?.role === "assistant" ? "message" : "bottom");
    }

    productMarkup(products = []) {
      if (!products.length) return "";
      const money = new Intl.NumberFormat(this.config.locale, { style: "currency", currency: this.config.currency, maximumFractionDigits: 0 });
      return `<div class="recommendations-list">${products.map((product) => `<article class="recommendation" part="card product-card">
        ${product.canView === false
          ? `<div class="recommendation-image" role="img" aria-label="${safe(product.name)}" style="background-image:url('${safe(mediaUrl(product.imageUrl))}');background-position:${slotPosition[product.imageSlot] || "center"};background-size:${Number.isInteger(product.imageSlot) ? "400% 200%" : "cover"}"></div>`
          : `<button type="button" class="recommendation-image product-image-link" data-view="${safe(product.slug)}" data-product-id="${safe(product.id)}" aria-label="${safe(`${product.name} ${product.viewLabel || this.labels.view}`)}" style="background-image:url('${safe(mediaUrl(product.imageUrl))}');background-position:${slotPosition[product.imageSlot] || "center"};background-size:${Number.isInteger(product.imageSlot) ? "400% 200%" : "cover"}"></button>`}
        <div><small>${safe(product.category)}</small><h3>${product.canView === false ? safe(product.name) : `<button type="button" class="product-title" data-view="${safe(product.slug)}" data-product-id="${safe(product.id)}">${safe(product.name)}</button>`}</h3><div class="price">${product.compareAt > product.price ? `<del>${money.format(Number(product.compareAt) || 0)}</del>` : ""}<strong>${money.format(Number(product.price) || 0)}</strong></div><p>${safe(product.reason)}</p></div>
        ${(product.sizes?.length || product.colors?.length) ? `<div class="variants">
          ${product.sizes?.length === 1 ? `<label><span>${safe(this.labels.size)}</span><output class="variant-locked">${safe(product.sizes[0])}</output></label>` : product.sizes?.length ? `<label><span>${safe(this.labels.size)}</span><select data-variant="size" data-product-id="${safe(product.id)}">${product.sizes.map((size) => `<option value="${safe(size)}"${size === product.selectedSize ? " selected" : ""}>${safe(size)}</option>`).join("")}</select></label>` : ""}
          ${product.colors?.length === 1 ? `<label><span>${safe(this.labels.color)}</span><output class="variant-locked">${safe(product.colors[0])}</output></label>` : product.colors?.length ? this.config.colorPicker === "swatches" ? `<label class="color-picker"><span>${safe(this.labels.color)} · <output class="swatch-value">${safe(product.selectedColor || product.colors[0])}</output></span><span class="color-swatches" role="group" aria-label="${safe(this.labels.color)}">${product.colors.map((color) => `<button type="button" data-color-value="${safe(color)}" data-product-id="${safe(product.id)}" aria-label="${safe(color)}" aria-pressed="${color === (product.selectedColor || product.colors[0])}" style="--swatch:${colorSwatch(color)}"></button>`).join("")}</span></label>` : `<label><span>${safe(this.labels.color)}</span><select data-variant="color" data-product-id="${safe(product.id)}">${product.colors.map((color) => `<option value="${safe(color)}"${color === product.selectedColor ? " selected" : ""}>${safe(color)}</option>`).join("")}</select></label>` : ""}
          ${this.config.showQuantity ? `<label><span>${safe(this.labels.quantity)}</span><select data-variant="quantity" data-product-id="${safe(product.id)}"><option>1</option><option>2</option><option>3</option></select></label>` : ""}
        </div>` : ""}
        <div class="recommendation-actions">
          ${product.canView === false ? "" : `<button type="button" class="view" data-view="${safe(product.slug)}" data-product-id="${safe(product.id)}">${safe(product.viewLabel || this.labels.view)}</button>`}
          ${product.canAdd === false ? "" : `<button type="button" class="add" data-add="${safe(product.id)}">${safe(product.addLabel || this.labels.add)}</button>`}
        </div>
      </article>`).join("")}</div>`;
    }

    statusMarkup(cards = []) {
      return cards.length ? `<div class="status-cards">${cards.map((card) => `<article class="status-card" part="card status-card"><small>${safe(card.kind === "order_tracking" ? this.labels.shipping : this.labels.order)}</small><h3>${safe(card.title || card.order_number || card.id)}</h3><p>${safe(card.message || card.status || "")}</p>${card.tracking_code ? `<strong>${safe(card.tracking_code)}</strong>` : ""}${card.estimated_delivery ? `<time>${safe(card.estimated_delivery)}</time>` : ""}</article>`).join("")}</div>` : "";
    }

    actionMarkup(actions = []) {
      return actions.length ? `<div class="message-actions">${actions.map((action) => `<a part="action standalone-action" href="${safe(action.url)}" target="_blank" rel="noopener noreferrer" data-action-url="${safe(action.url)}">${safe(action.label)} <span aria-hidden="true">↗</span></a>`).join("")}</div>` : "";
    }

    quickMarkup(items = []) {
      return items.length ? `<div class="quick">${items.map((item) => {
        const label = typeof item === "string" ? item : item?.label;
        const value = typeof item === "string" ? item : item?.value;
        return label && value ? `<button type="button" data-quick="${safe(value)}">${safe(label)}</button>` : "";
      }).join("")}</div>` : "";
    }

    feedbackMarkup(message, index) {
      if (!message.executionId || !this.configured) return "";
      return `<div class="feedback" aria-label="${safe(this.labels.feedback)}">
        <span>${safe(this.labels.feedback)}</span>
        <button type="button" data-feedback="1" data-message-index="${index}" aria-label="${safe(this.labels.helpful)}" aria-pressed="${message.feedback === 1}">${THUMB_UP_ICON}</button>
        <button type="button" data-feedback="-1" data-message-index="${index}" aria-label="${safe(this.labels.notHelpful)}" aria-pressed="${message.feedback === -1}">${THUMB_DOWN_ICON}</button>
      </div>`;
    }

    scroll(target = "bottom") {
      requestAnimationFrame(() => {
        const area = this.root.querySelector(".conversation");
        if (!area) return;
        if (target === "message") {
          const message = area.querySelector(".messages .message:last-child");
          area.scrollTop = message ? Math.max(0, message.offsetTop - 8) : area.scrollHeight;
          return;
        }
        area.scrollTop = area.scrollHeight;
      });
    }

    compactStyles() {
      return `
        .panel {
          width: min(396px, calc(100vw - 32px));
          height: min(640px, calc(100dvh - 48px));
          grid-template-rows: auto minmax(0, 1fr) repeat(3, auto);
        }
        .panel header { min-height: 64px; padding-block: 11px; }
        .panel-actions { gap: 3px !important; }
        .panel-actions button {
          width: 36px;
          height: 36px;
          padding: 0;
          border: 0;
          background: transparent;
          color: #fff;
          cursor: pointer;
          line-height: 1;
        }
        .new-chat { font-size: 24px; font-weight: 300; }
        .close { font-size: 28px; }
        .launcher i svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; }
        .conversation { padding-inline: 14px; }
        .welcome-message { margin-top: 0; padding: 0 0 12px; border: 0; text-align: left; }
        .welcome-message > div > p { color: var(--pt-chat-text, #171715); }
        .message > p,
        .message.assistant > div > p { font-size: 12px; }
        .recommendations-list { gap: 8px; }
        .recommendation {
          grid-template-columns: 74px minmax(0, 1fr);
          gap: 8px 10px;
          padding: 9px;
        }
        .recommendation-image {
          width: 74px;
          height: 96px;
        }
        .recommendation h3 { margin-top: 2px; font-size: 15px; }
        .price { display: flex; align-items: baseline; gap: 7px; }
        .price del { color: var(--pt-chat-muted, #68655f); font-size: 9px; }
        .recommendation div:nth-child(2) > p {
          display: -webkit-box;
          overflow: hidden;
          margin-top: 5px;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          line-clamp: 2;
        }
        .recommendation-actions {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 0.8fr 1.2fr;
          gap: 7px;
        }
        .recommendation-actions button {
          grid-column: auto;
          min-height: 31px;
        }
        .message-actions { display: grid; gap: 7px; margin-top: 8px; }
        .message-actions a {
          min-height: 38px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 9px 12px;
          border: 1px solid var(--pt-accent);
          background: var(--pt-accent);
          color: #fff;
          font: 600 10px/1.3 inherit;
          letter-spacing: .05em;
          text-decoration: none;
          text-transform: uppercase;
        }
        .message-actions a:hover { filter: brightness(1.08); }
        .message-actions a:focus-visible { outline: 2px solid var(--pt-accent); outline-offset: 2px; }
        .variants { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
        .variants label { display: grid; gap: 3px; color: #77736c; font-size: 8px; text-transform: uppercase; letter-spacing: .08em; }
        .variants select, .variant-locked { min-width: 0; height: 31px; border: 1px solid var(--pt-chat-border, #d7d2c9); background: var(--pt-chat-surface, #fff); color: var(--pt-chat-text, #171715); padding: 0 6px; font: 10px inherit; }
        .variant-locked { display: flex; align-items: center; color: var(--pt-chat-muted, #68655f); }
        .color-picker { grid-column: span 2; }
        .swatch-value { color: inherit; font: inherit; }
        .color-swatches { display: flex; flex-wrap: wrap; gap: 8px; padding-block: 3px; }
        .color-swatches button { width: 23px; height: 23px; padding: 0; border: 1px solid #aaa59d; border-radius: 50%; background: var(--swatch); cursor: pointer; box-shadow: inset 0 0 0 2px var(--pt-chat-surface, #fff); }
        .color-swatches button[aria-pressed="true"] { outline: 1px solid var(--pt-chat-text, #171715); outline-offset: 2px; }
        .status-cards { display: grid; gap: 8px; margin-top: 10px; }
        .status-card { display: grid; gap: 5px; padding: 12px; border: 1px solid var(--pt-chat-border, #d7d2c9); background: var(--pt-chat-surface, #fff); }
        .status-card small { color: var(--pt-chat-muted, #68655f); text-transform: uppercase; letter-spacing: .1em; font-size: 8px; }
        .status-card h3, .status-card p { margin: 0; }
        .status-card h3 { font: 400 16px/1.2 Georgia, serif; }
        .status-card p, .status-card time { color: var(--pt-chat-muted, #68655f); font-size: 10px; }
        .offline { margin: 8px 0; border: 1px solid #d8a52f; background: #fff8df; padding: 9px; color: #59420c; font-size: 10px; }
        .typing { position: relative; width: fit-content; max-width: calc(100% - 40px); min-height: 34px; padding: 9px 11px; border: 1px solid var(--pt-chat-border, #d7d2c9); background: var(--pt-chat-surface, #fff); }
        .typing::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 2px; content: ""; background: linear-gradient(90deg, transparent, var(--pt-accent), transparent); background-size: 200% 100%; animation: activity-progress 1.4s linear infinite; }
        .typing em { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .typing time { flex: 0 0 auto; margin-left: 7px; color: var(--pt-chat-muted, #68655f); font: 600 8px/1 inherit; letter-spacing: .04em; }
        .typing.is-finalizing span { background: #54825a; }
        @keyframes activity-progress { to { background-position: -200% 0; } }
        button:focus-visible, select:focus-visible { outline: 2px solid color-mix(in srgb, var(--pt-accent) 70%, white); outline-offset: 2px; }
        .composer:focus-within { border-color: var(--pt-accent); }
        .composer textarea:focus-visible { outline: none; }
        .composer textarea { min-height: 47px; padding-block: 14px; }
        .legal-consent { margin: 0 14px 8px; border: 1px solid var(--pt-chat-border, #d7d2c9); background: var(--pt-chat-surface, #fff); padding: 11px; }
        .legal-consent p { margin: 0 0 9px; color: var(--pt-chat-muted, #68655f); font-size: 9px; line-height: 1.45; }
        .legal-consent a { color: var(--pt-chat-text, #171715); text-underline-offset: 2px; }
        .legal-consent button { width: 100%; min-height: 34px; border: 1px solid var(--pt-accent); background: var(--pt-accent); color: #fff; cursor: pointer; font: 600 9px/1 inherit; letter-spacing: .08em; text-transform: uppercase; }
        .legal-inline { margin: -2px 14px 8px; color: var(--pt-chat-muted, #68655f); font-size: 8px; line-height: 1.4; text-align: center; }
        .legal-inline a { color: var(--pt-chat-text, #171715); text-underline-offset: 2px; }
        .ai-disclaimer { margin: -1px 14px 7px; color: var(--pt-chat-muted, #68655f); font-size: 8px; line-height: 1.35; text-align: center; }
        .feedback { display: flex; align-items: center; justify-content: flex-end; gap: 5px; margin-top: 7px; color: #77736c; font-size: 9px; }
        .feedback button { display: grid; place-items: center; width: 27px; height: 27px; padding: 0; border: 1px solid #d7d2c9; border-radius: 50%; background: #fff; color: #77736c; cursor: pointer; }
        .feedback button svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; stroke-width: 1.5; }
        .feedback button[aria-pressed="true"] { border-color: #171715; background: #ebe7df; color: #171715; }
        @media (max-width: 560px) {
          .panel {
            position: fixed !important;
            inset: max(8px, env(safe-area-inset-top)) 8px max(8px, env(safe-area-inset-bottom)) !important;
            width: calc(100vw - 16px) !important;
            min-width: 0 !important;
            max-width: calc(100vw - 16px) !important;
            height: calc(100dvh - 16px) !important;
            max-height: calc(100dvh - 16px) !important;
          }
          .composer textarea, .variants select { font-size: 16px; }
        }
      `;
    }

    styles(accent) {
      return `:host{--pt-accent:var(--pt-chat-accent,${safe(accent)});position:fixed;right:var(--pt-chat-right,24px);bottom:var(--pt-chat-bottom,24px);z-index:var(--pt-chat-z-index,2147483000);font-family:var(--pt-chat-font-family,Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--pt-chat-text,#171715);line-height:1.45;contain:style;-webkit-text-size-adjust:100%;text-size-adjust:100%}:host *{box-sizing:border-box;min-width:0}[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden}.launcher{width:230px;min-height:64px;border:0;border-radius:2px;background:var(--pt-accent);color:#fff;display:flex;align-items:center;gap:12px;padding:10px 14px;box-shadow:0 15px 42px rgba(0,0,0,.25);cursor:pointer;text-align:left}.launcher-mark,.avatar,.mini-avatar{display:grid;place-items:center;border:1px solid currentColor;font-family:Georgia,serif}.launcher-mark{width:36px;height:36px;font-size:20px}.launcher span:nth-child(2){display:grid;flex:1}.launcher strong{font:600 12px/1.3 inherit;letter-spacing:.02em}.launcher small{font-size:10px;color:rgba(255,255,255,.65)}.launcher i{font-style:normal;font-size:20px}.panel{position:absolute;right:0;bottom:0;width:min(420px,calc(100vw - 32px));height:min(680px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);background:#f7f5f0;border:1px solid #d7d2c9;box-shadow:0 24px 70px rgba(0,0,0,.27);display:none;grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden}.panel.is-open{display:grid}.panel header{background:var(--pt-accent);color:#fff;min-height:72px;padding:13px 17px;display:flex;justify-content:space-between;align-items:center}.panel header>div{display:flex;gap:12px;align-items:center}.avatar{width:38px;height:38px;font-size:20px}.panel header p{display:grid;margin:0}.panel header strong{font-family:Georgia,serif;font-size:16px;font-weight:400}.panel header small{font-size:10px;color:rgba(255,255,255,.68);margin-top:3px}.panel header small i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#87bd8b;margin-right:4px}.close{border:0;background:transparent;color:#fff;font-size:29px;line-height:1;cursor:pointer}.conversation{min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;padding:22px 18px 14px;scrollbar-width:thin}.conversation.has-messages{padding-top:8px}.conversation.has-messages .welcome,.conversation.has-messages .quick.initial{display:none}.welcome{text-align:center;border-bottom:1px solid #dfdbd3;padding:4px 15px 20px}.welcome-mark{display:grid;place-items:center;margin:0 auto 11px;border:1px solid #171715;width:40px;height:40px;font:22px Georgia,serif}.welcome h2{font:400 27px/1.1 Georgia,serif;margin:0 0 9px}.welcome p{font-size:12px;color:#65635f;margin:0}.quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.quick.initial{justify-content:center;padding:4px 0 15px}.quick button{border:1px solid #cbc6bd;background:#fff;border-radius:20px;padding:8px 11px;font:500 10px inherit;cursor:pointer;color:#3c3b38}.quick button:hover{border-color:#171715}.message{margin:12px 0;overflow-wrap:anywhere}.message>p,.message.assistant>div>p{margin:0;padding:12px 14px;font-size:13px;white-space:pre-line}.message.user{display:flex;justify-content:flex-end}.message.user>p{background:var(--pt-accent);color:#fff;max-width:82%;border-radius:13px 13px 2px 13px}.message.assistant{display:grid;grid-template-columns:25px minmax(0,1fr);gap:8px;align-items:start}.message.assistant>div>p{background:#fff;border:1px solid #e0dcd4;border-radius:2px 13px 13px 13px}.mini-avatar{width:25px;height:25px;font:13px Georgia,serif}.recommendations-list{display:grid;gap:10px;margin-top:10px}.recommendation{background:#fff;border:1px solid #dcd7ce;padding:10px;display:grid;grid-template-columns:86px minmax(0,1fr);gap:9px}.recommendation-image{width:86px;height:112px;background-repeat:no-repeat;background-color:#ddd6cc}.product-image-link{display:block;grid-column:auto;min-height:0;padding:0;border:0;border-radius:0;appearance:none}.recommendation h3{font:400 16px/1.15 Georgia,serif;margin:3px 0}.product-title{display:block;width:100%;min-height:0;border:0;background:transparent;color:inherit;padding:0;font:inherit;line-height:inherit;letter-spacing:inherit;text-align:left;text-transform:none;white-space:normal;overflow-wrap:break-word;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:3px;cursor:pointer}.recommendation small{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#77736c}.recommendation strong{font-size:11px}.recommendation div:nth-child(2)>p{font-size:10px;color:#68655f;margin:7px 0 0}.recommendation-actions button{grid-column:auto;min-height:34px;text-transform:uppercase;font:600 9px inherit;letter-spacing:.08em;cursor:pointer}.recommendation .view{background:#fff;border:1px solid #171715}.recommendation .add{background:#171715;color:#fff;border:1px solid #171715}.typing{display:flex;align-items:center;gap:4px;margin:16px 0 10px 33px}.typing span{width:6px;height:6px;border-radius:50%;background:#777;animation:pulse 1.1s infinite}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}.typing em{font:normal 9px inherit;color:#777;margin-left:5px}.typing[hidden]{display:none}@keyframes pulse{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}.composer{margin:0 14px 10px;border:1px solid #c9c4bb;background:#fff;display:grid;grid-template-columns:minmax(0,1fr) 41px;align-items:end}.composer textarea{width:100%;resize:none;border:0;outline:0;min-height:51px;max-height:90px;padding:16px 12px;background:transparent;font:13px inherit}.composer button{width:34px;height:34px;margin:0 6px 8px 0;border:0;border-radius:50%;background:var(--pt-accent);color:#fff;font-size:19px;cursor:pointer}.panel>footer{text-align:center;padding:0 10px 10px;color:#969188;text-transform:uppercase;font-size:8px;letter-spacing:.13em}.panel>footer span{color:#171715;font-size:11px}@media(max-width:560px){:host{right:12px;bottom:12px}.launcher{width:58px;height:58px;min-height:58px;padding:10px;border-radius:50%}.launcher span:nth-child(2),.launcher i{display:none}.launcher-mark{border:0}.panel{position:fixed!important;inset:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom))!important;width:calc(100vw - 16px)!important;min-width:0!important;max-width:calc(100vw - 16px)!important;height:calc(100dvh - 16px)!important;max-height:calc(100dvh - 16px)!important;border:1px solid #d7d2c9}.conversation{padding-left:14px;padding-right:14px}.composer textarea,.variants select{font-size:16px}}@media(max-height:620px){.panel header{min-height:60px;padding-top:9px;padding-bottom:9px}.conversation{padding-top:10px}.welcome-mark{display:none}.welcome h2{font-size:23px}.welcome{padding-top:0;padding-bottom:12px}.quick.initial{padding-bottom:8px}.composer{margin-bottom:7px}.panel>footer{padding-bottom:7px}}:host{--pt-chat-background:#f7f5f0;--pt-chat-surface:#fff;--pt-chat-border:#d7d2c9;--pt-chat-muted:#68655f;--pt-chat-radius:0px}.panel{background:var(--pt-chat-background);border-color:var(--pt-chat-border);border-radius:var(--pt-chat-radius)}.message.assistant>div>p,.recommendation,.quick button,.composer{background:var(--pt-chat-surface)}.message.assistant>div>p,.recommendation,.quick button,.composer{border-color:var(--pt-chat-border)}.recommendation div:nth-child(2)>p,.welcome p{color:var(--pt-chat-muted)}.recommendation .add{background:var(--pt-chat-text,#171715);border-color:var(--pt-chat-text,#171715);color:var(--pt-chat-surface,#fff)}@media(prefers-reduced-motion:reduce){.typing span{animation:none}}`;
    }
  }

  customElements.define(TAG, PromptRailsShopAssistant);
})();
