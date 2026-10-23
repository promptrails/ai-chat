const SAFE_LINK_PROTOCOLS = /^(https?:\/\/|mailto:|tel:|\/|#)/i;

/** Render the safe Markdown subset used in chat responses. */
export function renderChatMarkdown(value: string): string {
  if (!value) return "";

  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(`<p>${paragraph.map(renderInlineMarkdown).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    blocks.push(
      `<${tag}>${list.items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</${tag}>`,
    );
    list = null;
  };
  const flushCode = () => {
    if (!code) return;
    blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
    code = null;
  };

  for (const line of lines) {
    if (line.trimStart().startsWith("```")) {
      if (code) flushCode();
      else {
        flushParagraph();
        flushList();
        code = [];
      }
      continue;
    }
    if (code) {
      code.push(line);
      continue;
    }

    const listItem = line.match(/^\s*(?:([-*+•])|(\d+)[.)])\s+(.+)$/);
    if (listItem) {
      flushParagraph();
      const ordered = Boolean(listItem[2]);
      if (list && list.ordered !== ordered) flushList();
      list ??= { ordered, items: [] };
      list.items.push(listItem[3]);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushCode();
  flushParagraph();
  flushList();
  return blocks.join("");
}

function renderInlineMarkdown(value: string): string {
  const codeTokens: string[] = [];
  let html = escapeHtml(value).replace(/`([^`\n]+)`/g, (_match, content: string) => {
    const token = `@@PROMPTRAILS_CODE_${codeTokens.length}@@`;
    codeTokens.push(`<code>${content}</code>`);
    return token;
  });

  html = html.replace(/\[([^\]]+)]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const safeHref = sanitizeLinkHref(href);
    return safeHref
      ? `<a href="${escapeHtml(safeHref)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
  });
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.+?)__/g, "<strong>$1</strong>");
  html = html.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  html = html.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  html = html.replace(/@@PROMPTRAILS_CODE_(\d+)@@/g, (_match, index: string) => {
    return codeTokens[Number(index)] ?? "";
  });
  return html;
}

function sanitizeLinkHref(value: string): string {
  const candidate = value.trim();
  return SAFE_LINK_PROTOCOLS.test(candidate) ? candidate : "";
}

function escapeHtml(value: string): string {
  return String(value).replace(
    /[&<>'"]/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ??
      character,
  );
}
