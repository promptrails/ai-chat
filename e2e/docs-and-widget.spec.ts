import { readFileSync } from "node:fs";
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
