import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const packageVersion = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
).version;

test("corporate docs launches the credential-free ecommerce demo", async ({ page }) => {
  await page.goto("/#demo");
  await expect(
    page.getByRole("heading", { name: "Agent-ready chat, for every interface." }),
  ).toBeVisible();
  await expect(page.getByText("One browser runtime. Any renderer.")).toBeVisible();
  await page.getByRole("button", { name: "Launch Widget on This Page" }).click();

  const assistant = page.locator("promptrails-shop-assistant");
  await expect(assistant).toHaveCount(1);
  await expect(assistant.locator(".panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(assistant.locator(".panel")).not.toBeVisible();
});

test("widget remains inside the mobile viewport", async ({ page }) => {
  await page.goto("/#demo");
  await page.getByRole("button", { name: "Launch Widget on This Page" }).click();
  const assistant = page.locator("promptrails-shop-assistant");
  const panel = assistant.locator(".panel");
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
  if (viewport!.width <= 560) {
    const composerFontSize = await assistant
      .locator("textarea")
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    expect(composerFontSize).toBeGreaterThanOrEqual(16);
  }
});

test("shows a multi-buy offer separately from the selling price in summary cards", async ({
  page,
}) => {
  await page.setContent(
    '<promptrails-shop-assistant product-source="response" product-card-mode="summary"></promptrails-shop-assistant>',
  );
  await page.addScriptTag({
    path: fileURLToPath(new URL("../dist/ecommerce.global.js", import.meta.url)),
  });
  const assistant = page.locator("promptrails-shop-assistant");
  await assistant.getByRole("button", { name: "Sohbeti aç" }).click();
  await assistant.evaluate((element) => {
    const widget = element as HTMLElement & {
      normalizeAnswer: (answer: object) => { products: unknown[] };
      messages: object[];
      paintMessages: () => void;
    };
    const { products } = widget.normalizeAnswer({
      output: { message: "İstediğin kabanı aşağıda inceleyebilirsin." },
      ui: {
        version: "1",
        resources: [
          {
            id: "4732",
            kind: "product",
            attributes: {
              name: "Kahverengi Ari Maxi Kaşe Kaban",
              price: 6250,
              promotions: [
                { label: "2 ve üzeri %30 indirim", condition: "multi_buy", discounted_price: 4375 },
              ],
            },
          },
        ],
        actions: [],
        suggestions: [],
      },
    });
    widget.messages = [
      { role: "assistant", text: "İstediğin kabanı aşağıda inceleyebilirsin.", products },
    ];
    widget.paintMessages();
  });
  const card = assistant.locator("article.recommendation");
  await expect(card.locator(".price strong")).toHaveText(/6\.250/);
  await expect(card.locator(".price del")).toHaveCount(0);
  const offer = card.locator(".multi-buy-promotion");
  await expect(offer).toBeVisible();
  await expect(offer).toContainText("2 ve üzeri %30 indirim");
  await expect(offer).toContainText(/4\.375/);
  expect(await offer.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
});

test("renders storefront price tiers without clipping in a summary card", async ({ page }) => {
  await page.setContent(
    '<promptrails-shop-assistant product-source="response" product-card-mode="summary" product-price-display="storefront"></promptrails-shop-assistant>',
  );
  await page.addScriptTag({
    path: fileURLToPath(new URL("../dist/ecommerce.global.js", import.meta.url)),
  });
  const assistant = page.locator("promptrails-shop-assistant");
  await assistant.getByRole("button", { name: "Sohbeti aç" }).click();
  await assistant.evaluate((element) => {
    const widget = element as HTMLElement & {
      normalizeAnswer: (answer: object) => { message: string; products: unknown[] };
      messages: object[];
      paintMessages: () => void;
    };
    const { message, products } = widget.normalizeAnswer({
      output: { message: "Ceketi aşağıda inceleyebilirsin." },
      ui: {
        version: "1",
        resources: [
          {
            id: "jacket",
            kind: "product",
            attributes: {
              name: "Siyah Harlan Blazer Ceket",
              price: 2750,
              compare_at: 3450,
              promotions: [{ label: "Sepette", condition: "cart", discounted_price: 2337.5 }],
            },
          },
        ],
        actions: [],
        suggestions: [],
      },
    });
    widget.messages = [{ role: "assistant", text: message, products }];
    widget.paintMessages();
  });
  const card = assistant.locator("article.recommendation");
  const price = card.locator(".price");
  const cart = card.locator(".cart-promotion");
  await expect(price.locator("del")).toHaveText("3.450,00 TL");
  await expect(price.locator("strong")).toHaveText("2.750,00 TL");
  await expect(cart).toHaveText("Sepette 2.337,50 TL");
  for (const line of [price, cart]) {
    await expect(line).toBeVisible();
    expect(await line.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  }
});

test("docs show the package version and generate a complete browser snippet", async ({ page }) => {
  await page.goto("/#usage");
  await expect(page.getByText(`Open source · v${packageVersion}`)).toBeVisible();
  await expect(page.getByText(`npm install @promptrails/ai-chat@${packageVersion}`)).toBeVisible();

  await page.getByRole("button", { name: "React Component" }).click();
  await expect(page.locator("#layer-component")).toBeVisible();
  await page.getByRole("button", { name: "Script Tag" }).click();
  await expect(page.locator("#layer-script")).toBeVisible();

  await page.getByLabel("Experience").selectOption("generic");
  await page.getByLabel("Browser-only Chat Key").fill("browser-key");
  await page.getByLabel("Agent ID").fill("agent-id");
  await page.getByLabel("Workspace ID").fill("workspace-id");
  const generated = page.locator("#demo-code");
  await expect(generated).toContainText(`@promptrails/ai-chat@${packageVersion}`);
  await expect(generated).toContainText('data-base-url="https://api.promptrails.ai"');
  await expect(generated).toContainText('data-agent-id="agent-id"');
  await expect(generated).toContainText('data-workspace-id="workspace-id"');
});
