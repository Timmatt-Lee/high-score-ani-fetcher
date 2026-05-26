import { test, expect } from "@playwright/test";

test.describe("Tabs Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(1000, 1000);
  });

  test("should match search tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=search&searchCount=12&favoritesCount=5&trashCount=2",
    );
    await page
      .locator('[data-testid="tabs-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "tabs-search-active.png",
    );
  });

  test("should match favorites tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=favorites&searchCount=0&favoritesCount=0&trashCount=0",
    );
    await page
      .locator('[data-testid="tabs-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "tabs-favorites-active.png",
    );
  });

  test("should match trash tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=trash&searchCount=99&favoritesCount=42&trashCount=7",
    );
    await page
      .locator('[data-testid="tabs-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "tabs-trash-active.png",
    );
  });
});
