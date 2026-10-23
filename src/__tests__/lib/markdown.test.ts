import { describe, expect, it } from "vitest";
import { renderChatMarkdown } from "../../lib/markdown";

describe("renderChatMarkdown", () => {
  it("renders paragraphs, bold text, lists and safe links", () => {
    const html = renderChatMarkdown(
      "Güncel kampanyalar:\n\n- **Ayakkabı:** İkinci ürün %50\n- [Detaylar](https://www.desa.com.tr/kampanyalar)",
    );

    expect(html).toBe(
      '<p>Güncel kampanyalar:</p><ul><li><strong>Ayakkabı:</strong> İkinci ürün %50</li><li><a href="https://www.desa.com.tr/kampanyalar" target="_blank" rel="noopener noreferrer">Detaylar</a></li></ul>',
    );
  });

  it("accepts bullet characters produced by some models", () => {
    expect(renderChatMarkdown("• **Bir**\n• İki")).toBe(
      "<ul><li><strong>Bir</strong></li><li>İki</li></ul>",
    );
  });

  it("escapes raw HTML and drops executable link targets", () => {
    const html = renderChatMarkdown("<img src=x onerror=alert(1)> [aç](javascript:alert(1))");

    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).toContain("aç");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<img");
  });
});
