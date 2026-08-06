/* global CSS, CustomEvent, HTMLElement, TextDecoder, URL, customElements, document, fetch, localStorage, location, requestAnimationFrame, sessionStorage, window */
(() => {
  "use strict";

  if (typeof window === "undefined" || typeof customElements === "undefined") return;

  const TAG = "promptrails-shop-assistant";
  if (customElements.get(TAG)) return;

  const DEFAULT_SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;
  const MAX_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
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
  const stylesheetUrl = (value) => {
    const candidate = String(value ?? "").trim();
    return /^(https?:\/\/|\/|\.\.\/|\.\/)/.test(candidate) ? candidate : "";
  };

  class PromptRailsShopAssistant extends HTMLElement {
    static get observedAttributes() { return ["api-url", "workspace-id", "agent-id", "api-key", "catalog-url", "brand", "assistant-name", "assistant-mark", "launcher-title", "launcher-subtitle", "greeting", "placeholder", "quick-prompts", "accent-color", "currency", "locale", "stylesheet-url", "persist-session", "session-max-age"]; }

    constructor() {
      super();
      this.root = this.attachShadow({ mode: "open" });
      this.catalog = [];
      this.messages = [];
      this.chatId = "";
      this.resumeToken = "";
      this.accessToken = "";
      this.accessTokenExpiresAt = 0;
      this.hydrationPromise = Promise.resolve();
      this.open = false;
      this.busy = false;
      this.ready = false;
      this.onWindowKey = (event) => { if (event.key === "Escape" && this.open) this.toggle(false); };
      this.onCartConfirmed = (event) => this.cartConfirmed(event);
    }

    connectedCallback() {
      this.renderShell();
      this.bind();
      this.restore();
      this.hydrationPromise = this.hydrateSession();
      this.loadCatalog().finally(() => { this.ready = true; });
      window.addEventListener("keydown", this.onWindowKey);
      window.addEventListener("promptrails:cart-confirmed", this.onCartConfirmed);
    }

    disconnectedCallback() {
      window.removeEventListener("keydown", this.onWindowKey);
      window.removeEventListener("promptrails:cart-confirmed", this.onCartConfirmed);
    }

    attributeChangedCallback() {
      if (this.isConnected) this.renderShell();
    }

    get config() {
      const requestedSessionMaxAge = Number(this.getAttribute("session-max-age"));
      const sessionMaxAgeSeconds = Number.isFinite(requestedSessionMaxAge) && requestedSessionMaxAge > 0
        ? Math.min(Math.floor(requestedSessionMaxAge), MAX_SESSION_MAX_AGE_SECONDS)
        : DEFAULT_SESSION_MAX_AGE_SECONDS;
      const brand = this.getAttribute("brand")?.trim() || "Mağaza";
      return {
        apiUrl: cleanBase(this.getAttribute("api-url")),
        workspaceId: this.getAttribute("workspace-id")?.trim() ?? "",
        agentId: this.getAttribute("agent-id")?.trim() ?? "",
        apiKey: this.getAttribute("api-key")?.trim() ?? "",
        catalogUrl: this.getAttribute("catalog-url")?.trim() || "/api/katalog",
        brand,
        assistantName: this.getAttribute("assistant-name")?.trim() || `${brand} Stil Danışmanı`,
        assistantMark: plainText(this.getAttribute("assistant-mark") || brand).slice(0, 2).toLocaleUpperCase("tr-TR") || "AI",
        launcherTitle: this.getAttribute("launcher-title")?.trim() || "Stil danışmanı",
        launcherSubtitle: this.getAttribute("launcher-subtitle")?.trim() || "Size özel öneriler",
        greeting: this.getAttribute("greeting")?.trim() || "Merhaba, size nasıl yardımcı olabilirim?",
        placeholder: this.getAttribute("placeholder")?.trim() || "Nasıl bir parça arıyorsunuz?",
        quickPrompts: stringList(this.getAttribute("quick-prompts"), ["Günlük şık bir görünüm", "Bir davet için elbise", "Bütçeme göre öner"]),
        accent: this.getAttribute("accent-color")?.trim() || "#121212",
        currency: this.getAttribute("currency")?.trim().toLocaleUpperCase() || "TRY",
        locale: this.getAttribute("locale")?.trim() || "tr-TR",
        stylesheetUrl: stylesheetUrl(this.getAttribute("stylesheet-url")),
        persistSession: this.getAttribute("persist-session") !== "false",
        sessionMaxAgeMs: sessionMaxAgeSeconds * 1000,
      };
    }

    get configured() {
      const { apiUrl, agentId, apiKey } = this.config;
      return Boolean(apiUrl && agentId && apiKey && !apiKey.startsWith("your_"));
    }

    get storageKey() {
      const { workspaceId, agentId } = this.config;
      return `promptrails-shop-widget:${workspaceId || "demo"}:${agentId || "local"}`;
    }

    renderShell() {
      const { assistantName, assistantMark, launcherTitle, launcherSubtitle, greeting, placeholder, quickPrompts, accent, stylesheetUrl: customStylesheet } = this.config;
      this.root.innerHTML = `<style>${this.styles(accent)}${this.compactStyles()}</style>${customStylesheet ? `<link rel="stylesheet" href="${safe(customStylesheet)}">` : ""}
        <button class="launcher" type="button" aria-label="${safe(assistantName)} sohbetini aç" aria-expanded="${this.open}" ${this.open ? "hidden" : ""}>
          <span class="launcher-mark">${safe(assistantMark)}</span><span><strong>${safe(launcherTitle)}</strong><small>${safe(launcherSubtitle)}</small></span><i aria-hidden="true">↗</i>
        </button>
        <section class="panel ${this.open ? "is-open" : ""}" role="dialog" aria-modal="false" aria-label="${safe(assistantName)}">
          <header><div><span class="avatar">${safe(assistantMark)}</span><p><strong>${safe(assistantName)}</strong><small><i></i> Çevrimiçi</small></p></div><div class="panel-actions"><button class="new-chat" type="button" aria-label="Yeni sohbet başlat" title="Yeni sohbet">＋</button><button class="close" type="button" aria-label="Sohbeti küçült">×</button></div></header>
          <div class="conversation" aria-live="polite">
            <div class="welcome"><span class="welcome-mark">${safe(assistantMark)}</span><h2>Birlikte bulalım.</h2><p>${safe(greeting)}</p></div>
            <div class="quick initial">${quickPrompts.map((prompt) => `<button type="button">${safe(prompt)}</button>`).join("")}</div>
            <div class="messages"></div>
            <div class="typing" hidden><span></span><span></span><span></span><em>${safe(assistantName)} seçkiyi inceliyor</em></div>
          </div>
          <form class="composer"><label class="sr-only" for="pt-message">Mesajınız</label><textarea id="pt-message" rows="1" maxlength="800" placeholder="${safe(placeholder)}"></textarea><button type="submit" aria-label="Mesajı gönder">↑</button></form>
          <footer><span>✦</span> PromptRails ile çalışır${this.configured ? "" : " · Demo modu"}</footer>
        </section>`;
      this.paintMessages();
      this.bind();
    }

    bind() {
      const launcher = this.root.querySelector(".launcher");
      const close = this.root.querySelector(".close");
      const newChat = this.root.querySelector(".new-chat");
      const form = this.root.querySelector(".composer");
      if (launcher) launcher.onclick = () => this.toggle(!this.open);
      if (close) close.onclick = () => this.toggle(false);
      if (newChat) newChat.onclick = () => this.startNewSession();
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
      this.root.querySelectorAll("[data-view]").forEach((button) => { button.onclick = () => this.emit("promptrails:product-view", { slug: button.dataset.view, productId: button.dataset.productId }); });
      this.root.querySelectorAll("[data-add]").forEach((button) => { button.onclick = () => {
        const product = this.catalog.find((item) => item.id === button.dataset.add);
        if (!product) return;
        button.disabled = true;
        button.textContent = "Ekleniyor…";
        this.emit("promptrails:cart-add", { productId: product.id, slug: product.slug, size: product.sizes?.[0], color: product.colors?.[0] });
      }; });
      this.root.querySelectorAll("[data-feedback]").forEach((button) => {
        button.onclick = () => this.submitFeedback(Number(button.dataset.messageIndex), Number(button.dataset.feedback));
      });
    }

    toggle(next) {
      this.open = next;
      this.root.querySelector(".panel")?.classList.toggle("is-open", next);
      const launcher = this.root.querySelector(".launcher");
      launcher?.setAttribute("aria-expanded", String(next));
      if (launcher) launcher.hidden = next;
      if (next) requestAnimationFrame(() => this.root.querySelector("textarea")?.focus());
    }

    emit(name, detail) {
      this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    startNewSession() {
      const previousSession = this.chatId && this.resumeToken ? { chatId: this.chatId, resumeToken: this.resumeToken } : null;
      this.chatId = "";
      this.resumeToken = "";
      this.messages = [];
      try {
        localStorage.removeItem(this.storageKey);
        sessionStorage.removeItem(this.storageKey);
      } catch { /* storage is optional */ }
      this.paintMessages();
      this.root.querySelector("textarea")?.focus();
      this.emit("promptrails:session-new", {});
      if (previousSession && this.configured) this.revokeSession(previousSession).catch(() => {});
    }

    async revokeSession({ chatId, resumeToken }) {
      const token = await this.ensureAccessToken();
      await fetch(`${this.config.apiUrl}/api/v1/browser/chat/sessions/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
        mode: "cors",
        credentials: "omit",
        headers: { Authorization: `Bearer ${token}`, "X-Chat-Resume-Token": resumeToken },
      });
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
        this.chatId = typeof saved.chatId === "string" && /^[0-9A-Za-z]{27}$/.test(saved.chatId) ? saved.chatId : "";
        this.resumeToken = typeof saved.resumeToken === "string" && saved.resumeToken.length >= 32 ? saved.resumeToken : "";
        if (!this.resumeToken) this.chatId = "";
        this.messages = Array.isArray(saved.messages)
          ? saved.messages.slice(-20).map((message) =>
            message?.role === "user" ? { ...message, text: visibleUserText(message.text) } : message,
          )
          : [];
        localStorage.setItem(this.storageKey, JSON.stringify({ chatId: this.chatId, resumeToken: this.resumeToken, messages: this.messages, lastActivityAt }));
        sessionStorage.removeItem(this.storageKey);
        this.paintMessages();
      } catch { /* private-mode storage can be unavailable */ }
    }

    persist() {
      if (!this.config.persistSession) return;
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          chatId: this.chatId,
          resumeToken: this.resumeToken,
          messages: this.messages.slice(-20),
          lastActivityAt: Date.now(),
        }));
      } catch { /* optional persistence */ }
    }

    async hydrateSession() {
      if (!this.configured || !this.chatId || !this.resumeToken) return;
      const restoringChatId = this.chatId;
      const restoringResumeToken = this.resumeToken;
      try {
        const payload = await this.runtimeRequest(`${this.config.apiUrl}/api/v1/browser/chat/sessions/${encodeURIComponent(restoringChatId)}/messages?limit=50`);
        if (this.chatId !== restoringChatId || this.resumeToken !== restoringResumeToken) return;
        const rows = Array.isArray(payload.data) ? payload.data : [];
        if (!rows.length) {
          this.persist();
          return;
        }
        this.messages = rows.filter((row) => row?.role === "user" || row?.role === "assistant").map((row) => {
          if (row.role === "user") return { role: "user", text: visibleUserText(row.content) };
          return { role: "assistant", ...this.normalizeAnswer({ output: row.content, executionId: row.metadata?.execution_id }) };
        }).slice(-20);
        this.persist();
        this.paintMessages();
      } catch (error) {
        if (error?.status === 403 || error?.status === 404) this.startNewSession();
      }
    }

    async send(content) {
      this.toggle(true);
      if (!this.ready) await this.loadCatalog();
      await this.hydrationPromise;
      this.messages.push({ role: "user", text: content });
      this.busy = true;
      this.paintMessages();
      this.setTyping(true);
      try {
        const result = this.configured ? await this.askPromptRails(content) : await this.localAnswer(content);
        this.messages.push({ role: "assistant", ...result });
      } catch (error) {
        this.messages.push({ role: "assistant", text: this.errorMessage(error), products: [], quickReplies: ["Tekrar deneyelim"] });
      } finally {
        this.busy = false;
        this.setTyping(false);
        this.persist();
        this.paintMessages();
      }
    }

    async askPromptRails(customerMessage) {
      const { apiUrl, agentId } = this.config;
      const base = `${apiUrl}/api/v1`;
      if (!this.chatId) {
        const created = await this.runtimeRequest(`${base}/browser/chat/sessions`, {
          method: "POST",
          body: JSON.stringify({ agent_id: agentId, title: `${this.config.brand} web mağazası`, metadata: { channel: "ecommerce_widget" } }),
        });
        this.chatId = String(created.data?.id ?? created.data?.session_id ?? "");
        this.resumeToken = String(created.data?.resume_token ?? "");
        if (!this.chatId || !this.resumeToken) throw new Error("Sohbet oturumu başlatılamadı.");
        this.persist();
      }
      const content = [
        "<SAYFA_BAGLAMI>",
        JSON.stringify({ baslik: document.title, yol: location.pathname }),
        "</SAYFA_BAGLAMI>",
        "<MUSTERI_MESAJI>",
        customerMessage,
        "</MUSTERI_MESAJI>",
      ].join("\n");
      try {
        const result = await this.readMessageStream(`${base}/browser/chat/sessions/${encodeURIComponent(this.chatId)}/messages/stream`, content);
        return this.normalizeAnswer(result);
      } catch (error) {
        if (error?.status !== 403) throw error;
        this.chatId = "";
        this.resumeToken = "";
        this.persist();
        return this.askPromptRails(customerMessage);
      }
    }

    async ensureAccessToken(force = false) {
      if (!force && this.accessToken && Date.now() < this.accessTokenExpiresAt - 30_000) return this.accessToken;
      const response = await fetch(`${this.config.apiUrl}/api/v1/browser/chat/token`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { Accept: "application/json", "Content-Type": "application/json", "X-API-Key": this.config.apiKey },
        body: JSON.stringify({ agent_id: this.config.agentId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw this.httpError(response.status, payload);
      this.accessToken = String(payload.data?.access_token ?? "");
      const expiresIn = Number(payload.data?.expires_in) || 900;
      this.accessTokenExpiresAt = Date.now() + expiresIn * 1000;
      if (!this.accessToken) throw new Error("Geçici sohbet anahtarı alınamadı.");
      return this.accessToken;
    }

    async runtimeRequest(url, options = {}, retry = true) {
      const token = await this.ensureAccessToken();
      const response = await fetch(url, {
        mode: "cors",
        credentials: "omit",
        ...options,
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
          ...(this.chatId && this.resumeToken ? { "X-Chat-Resume-Token": this.resumeToken } : {}),
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(options.headers || {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 && retry) {
        await this.ensureAccessToken(true);
        return this.runtimeRequest(url, options, false);
      }
      if (!response.ok) throw this.httpError(response.status, payload);
      return payload;
    }

    httpError(status, payload = {}) {
      const detail = typeof payload.error === "string" ? payload.error : payload.error?.message ?? payload.message;
      const error = new Error(detail || `İstek başarısız (${status}).`);
      error.status = status;
      return error;
    }

    async readMessageStream(url, content) {
      const token = await this.ensureAccessToken();
      let response = await fetch(url, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        headers: { Accept: "text/event-stream", "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Chat-Resume-Token": this.resumeToken },
        body: JSON.stringify({ content }),
      });
      if (response.status === 401) {
        const refreshed = await this.ensureAccessToken(true);
        response = await fetch(url, {
          method: "POST", mode: "cors", credentials: "omit",
          headers: { Accept: "text/event-stream", "Content-Type": "application/json", Authorization: `Bearer ${refreshed}`, "X-Chat-Resume-Token": this.resumeToken },
          body: JSON.stringify({ content }),
        });
      }
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw this.httpError(response.status, payload);
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalOutput;
      let uiEvent;
      let executionId = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const event = block.match(/^event:\s*(.+)$/m)?.[1]?.trim() || "message";
          const raw = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
          if (!raw) continue;
          const data = JSON.parse(raw);
          if (event === "error") throw new Error(data.message || data.error || "Agent yanıt veremedi.");
          if (event === "execution") executionId = String(data.execution_id ?? "");
          if (event === "ui") uiEvent = data;
          if (event === "done" || event === "complete") finalOutput = data.output ?? data.result ?? data;
        }
        if (done) break;
      }
      if (finalOutput === undefined) throw new Error("Agent yanıtı tamamlanamadı.");
      return { output: finalOutput, ui: uiEvent, executionId };
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
      const genericUI = result?.ui?.version === "1" ? result.ui : value.ui?.version === "1" ? value.ui : null;
      const resources = genericUI ? genericUI.resources?.filter((resource) => resource?.kind === "product") ?? [] : [];
      const requested = resources.length ? resources : Array.isArray(value.products) ? value.products : Array.isArray(value.urunler) ? value.urunler : [];
      const actions = Array.isArray(genericUI?.actions) ? genericUI.actions : [];
      const products = requested.map((entry) => {
        const id = typeof entry === "string" ? entry : entry.id ?? entry.product_id;
        const product = this.catalog.find((item) => item.id === id);
        const attributes = entry?.attributes && typeof entry.attributes === "object" ? entry.attributes : entry;
        const resourceActions = actions.filter((action) => action?.resource_id === id);
        const viewAction = resourceActions.find((action) => action.kind === "resource.open");
        const addAction = resourceActions.find((action) => action.kind === "cart.add");
        return product ? {
          ...product,
          reason: plainText(attributes.reason ?? attributes.neden ?? "Size uygun bir seçenek."),
          canView: !genericUI || Boolean(viewAction),
          canAdd: !genericUI || Boolean(addAction),
          viewLabel: plainText(viewAction?.label ?? "İncele"),
          addLabel: plainText(addAction?.label ?? "Sepete ekle"),
        } : null;
      }).filter(Boolean).slice(0, 3);
      return {
        text: plainText(value.message ?? value.mesaj ?? value.answer ?? "Seçkiden birkaç alternatif hazırladım."),
        products,
        quickReplies: genericUI
          ? (genericUI.suggestions ?? []).filter((item) => typeof item?.label === "string" && typeof item?.value === "string").map((item) => ({ label: plainText(item.label), value: plainText(item.value) })).slice(0, 3)
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

    setTyping(visible) {
      const element = this.root.querySelector(".typing");
      if (element) element.hidden = !visible;
      this.scroll();
    }

    cartConfirmed(event) {
      const id = event.detail?.productId;
      const button = this.root.querySelector(`[data-add="${CSS.escape(String(id))}"]`);
      if (button) { button.textContent = "Sepete eklendi ✓"; button.disabled = false; }
    }

    async submitFeedback(messageIndex, value) {
      const message = this.messages[messageIndex];
      if (!message?.executionId || !this.chatId || !this.resumeToken || ![-1, 1].includes(value)) return;
      message.feedback = value;
      this.persist();
      this.paintMessages();
      try {
        await this.runtimeRequest(`${this.config.apiUrl}/api/v1/browser/chat/sessions/${encodeURIComponent(this.chatId)}/feedback`, {
          method: "POST",
          body: JSON.stringify({ execution_id: message.executionId, value }),
        });
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
        : `<article class="message assistant"><span class="mini-avatar">${safe(this.config.assistantMark)}</span><div><p>${safe(message.text)}</p>${this.productMarkup(message.products)}${this.quickMarkup(message.quickReplies)}${this.feedbackMarkup(message, index)}</div></article>`).join("");
      this.bind();
      this.scroll(this.messages.at(-1)?.role === "assistant" ? "message" : "bottom");
    }

    productMarkup(products = []) {
      if (!products.length) return "";
      const money = new Intl.NumberFormat(this.config.locale, { style: "currency", currency: this.config.currency, maximumFractionDigits: 0 });
      return `<div class="recommendations-list">${products.map((product) => `<article class="recommendation">
        <div class="recommendation-image" role="img" aria-label="${safe(product.name)}" style="background-image:url('${safe(mediaUrl(product.imageUrl))}');background-position:${slotPosition[product.imageSlot] || "center"};background-size:${Number.isInteger(product.imageSlot) ? "400% 200%" : "cover"}"></div>
        <div><small>${safe(product.category)}</small><h3>${safe(product.name)}</h3><strong>${money.format(Number(product.price) || 0)}</strong><p>${safe(product.reason)}</p></div>
        <div class="recommendation-actions">
          ${product.canView === false ? "" : `<button type="button" class="view" data-view="${safe(product.slug)}" data-product-id="${safe(product.id)}">${safe(product.viewLabel || "İncele")}</button>`}
          ${product.canAdd === false ? "" : `<button type="button" class="add" data-add="${safe(product.id)}">${safe(product.addLabel || "Sepete ekle")}</button>`}
        </div>
      </article>`).join("")}</div>`;
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
      return `<div class="feedback" aria-label="Yanıtı değerlendir">
        <span>Bu öneri yardımcı oldu mu?</span>
        <button type="button" data-feedback="1" data-message-index="${index}" aria-label="Olumlu değerlendir" aria-pressed="${message.feedback === 1}">👍</button>
        <button type="button" data-feedback="-1" data-message-index="${index}" aria-label="Olumsuz değerlendir" aria-pressed="${message.feedback === -1}">👎</button>
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
        .conversation { padding-inline: 14px; }
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
        .composer textarea { min-height: 47px; padding-block: 14px; }
        .feedback { display: flex; align-items: center; justify-content: flex-end; gap: 5px; margin-top: 7px; color: #77736c; font-size: 9px; }
        .feedback button { width: 27px; height: 27px; padding: 0; border: 1px solid #d7d2c9; border-radius: 50%; background: #fff; cursor: pointer; font-size: 12px; filter: grayscale(1); }
        .feedback button[aria-pressed="true"] { border-color: #171715; background: #ebe7df; filter: none; }
        @media (max-width: 560px) {
          .panel { width: auto; height: auto; }
        }
      `;
    }

    styles(accent) {
      return `:host{--pt-accent:var(--pt-chat-accent,${safe(accent)});position:fixed;right:var(--pt-chat-right,24px);bottom:var(--pt-chat-bottom,24px);z-index:var(--pt-chat-z-index,2147483000);font-family:var(--pt-chat-font-family,Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif);color:var(--pt-chat-text,#171715);line-height:1.45;contain:style}:host *{box-sizing:border-box}[hidden]{display:none!important}.sr-only{position:absolute;width:1px;height:1px;clip:rect(0,0,0,0);overflow:hidden}.launcher{width:230px;min-height:64px;border:0;border-radius:2px;background:var(--pt-accent);color:#fff;display:flex;align-items:center;gap:12px;padding:10px 14px;box-shadow:0 15px 42px rgba(0,0,0,.25);cursor:pointer;text-align:left}.launcher-mark,.avatar,.mini-avatar{display:grid;place-items:center;border:1px solid currentColor;font-family:Georgia,serif}.launcher-mark{width:36px;height:36px;font-size:20px}.launcher span:nth-child(2){display:grid;flex:1}.launcher strong{font:600 12px/1.3 inherit;letter-spacing:.02em}.launcher small{font-size:10px;color:rgba(255,255,255,.65)}.launcher i{font-style:normal;font-size:20px}.panel{position:absolute;right:0;bottom:0;width:min(420px,calc(100vw - 32px));height:min(680px,calc(100dvh - 48px));max-height:calc(100dvh - 48px);background:#f7f5f0;border:1px solid #d7d2c9;box-shadow:0 24px 70px rgba(0,0,0,.27);display:none;grid-template-rows:auto minmax(0,1fr) auto auto;overflow:hidden}.panel.is-open{display:grid}.panel header{background:var(--pt-accent);color:#fff;min-height:72px;padding:13px 17px;display:flex;justify-content:space-between;align-items:center}.panel header>div{display:flex;gap:12px;align-items:center}.avatar{width:38px;height:38px;font-size:20px}.panel header p{display:grid;margin:0}.panel header strong{font-family:Georgia,serif;font-size:16px;font-weight:400}.panel header small{font-size:10px;color:rgba(255,255,255,.68);margin-top:3px}.panel header small i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#87bd8b;margin-right:4px}.close{border:0;background:transparent;color:#fff;font-size:29px;line-height:1;cursor:pointer}.conversation{min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:22px 18px 14px;scrollbar-width:thin}.conversation.has-messages{padding-top:8px}.conversation.has-messages .welcome,.conversation.has-messages .quick.initial{display:none}.welcome{text-align:center;border-bottom:1px solid #dfdbd3;padding:4px 15px 20px}.welcome-mark{display:grid;place-items:center;margin:0 auto 11px;border:1px solid #171715;width:40px;height:40px;font:22px Georgia,serif}.welcome h2{font:400 27px/1.1 Georgia,serif;margin:0 0 9px}.welcome p{font-size:12px;color:#65635f;margin:0}.quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.quick.initial{justify-content:center;padding:4px 0 15px}.quick button{border:1px solid #cbc6bd;background:#fff;border-radius:20px;padding:8px 11px;font:500 10px inherit;cursor:pointer;color:#3c3b38}.quick button:hover{border-color:#171715}.message{margin:12px 0}.message>p,.message.assistant>div>p{margin:0;padding:12px 14px;font-size:13px;white-space:pre-line}.message.user{display:flex;justify-content:flex-end}.message.user>p{background:var(--pt-accent);color:#fff;max-width:82%;border-radius:13px 13px 2px 13px}.message.assistant{display:grid;grid-template-columns:25px 1fr;gap:8px;align-items:start}.message.assistant>div>p{background:#fff;border:1px solid #e0dcd4;border-radius:2px 13px 13px 13px}.mini-avatar{width:25px;height:25px;font:13px Georgia,serif}.recommendations-list{display:grid;gap:10px;margin-top:10px}.recommendation{background:#fff;border:1px solid #dcd7ce;padding:10px;display:grid;grid-template-columns:86px 1fr;gap:9px}.recommendation-image{width:86px;height:112px;background-repeat:no-repeat;background-color:#ddd6cc}.recommendation h3{font:400 16px/1.15 Georgia,serif;margin:3px 0}.recommendation small{font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:#77736c}.recommendation strong{font-size:11px}.recommendation div:nth-child(2)>p{font-size:10px;color:#68655f;margin:7px 0 0}.recommendation button{grid-column:1/-1;min-height:34px;text-transform:uppercase;font:600 9px inherit;letter-spacing:.08em;cursor:pointer}.recommendation .view{background:#fff;border:1px solid #171715}.recommendation .add{background:#171715;color:#fff;border:1px solid #171715}.typing{display:flex;align-items:center;gap:4px;margin:16px 0 10px 33px}.typing span{width:6px;height:6px;border-radius:50%;background:#777;animation:pulse 1.1s infinite}.typing span:nth-child(2){animation-delay:.15s}.typing span:nth-child(3){animation-delay:.3s}.typing em{font:normal 9px inherit;color:#777;margin-left:5px}.typing[hidden]{display:none}@keyframes pulse{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}.composer{margin:0 14px 10px;border:1px solid #c9c4bb;background:#fff;display:grid;grid-template-columns:1fr 41px;align-items:end}.composer textarea{resize:none;border:0;outline:0;min-height:51px;max-height:90px;padding:16px 12px;background:transparent;font:13px inherit}.composer button{width:34px;height:34px;margin:0 6px 8px 0;border:0;border-radius:50%;background:var(--pt-accent);color:#fff;font-size:19px;cursor:pointer}.panel>footer{text-align:center;padding:0 10px 10px;color:#969188;text-transform:uppercase;font-size:8px;letter-spacing:.13em}.panel>footer span{color:#171715;font-size:11px}@media(max-width:560px){:host{right:12px;bottom:12px}.launcher{width:58px;height:58px;min-height:58px;padding:10px;border-radius:50%}.launcher span:nth-child(2),.launcher i{display:none}.launcher-mark{border:0}.panel{position:fixed;inset:max(8px,env(safe-area-inset-top)) 8px max(8px,env(safe-area-inset-bottom));width:auto;height:auto;max-height:none;border:1px solid #d7d2c9}.conversation{padding-left:14px;padding-right:14px}}@media(max-height:620px){.panel header{min-height:60px;padding-top:9px;padding-bottom:9px}.conversation{padding-top:10px}.welcome-mark{display:none}.welcome h2{font-size:23px}.welcome{padding-top:0;padding-bottom:12px}.quick.initial{padding-bottom:8px}.composer{margin-bottom:7px}.panel>footer{padding-bottom:7px}}:host{--pt-chat-background:#f7f5f0;--pt-chat-surface:#fff;--pt-chat-border:#d7d2c9;--pt-chat-muted:#68655f;--pt-chat-radius:0px}.panel{background:var(--pt-chat-background);border-color:var(--pt-chat-border);border-radius:var(--pt-chat-radius)}.message.assistant>div>p,.recommendation,.quick button,.composer{background:var(--pt-chat-surface)}.message.assistant>div>p,.recommendation,.quick button,.composer{border-color:var(--pt-chat-border)}.recommendation div:nth-child(2)>p,.welcome p{color:var(--pt-chat-muted)}.recommendation .add{background:var(--pt-chat-text,#171715);border-color:var(--pt-chat-text,#171715);color:var(--pt-chat-surface,#fff)}@media(prefers-reduced-motion:reduce){.typing span{animation:none}}`;
    }
  }

  customElements.define(TAG, PromptRailsShopAssistant);
})();
