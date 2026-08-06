import { expect, test } from "@playwright/test";

test("corporate docs launches the credential-free ecommerce demo", async ({ page }) => {
  await page.goto("/#demo");
  await expect(page.getByRole("heading", { name: "Agent-ready chat, for every interface." })).toBeVisible();
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
  const panel = page.locator("promptrails-shop-assistant").locator(".panel");
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
});
