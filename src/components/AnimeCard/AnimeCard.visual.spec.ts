import { test, expect } from "@playwright/test";

test.describe("AnimeCard Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(1000, 1000);
  });

  test("should match search tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=search");
    await page
      .locator('[data-testid="anime-card"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-card-search.png",
    );
  });

  test("should match favorites tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=favorites");
    await page
      .locator('[data-testid="anime-card"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-card-favorites.png",
    );
  });

  test("should match trash tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=trash");
    await page
      .locator('[data-testid="anime-card"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-card-trash.png",
    );
  });

  test("should match long title wrapping state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=long-title");
    await page
      .locator('[data-testid="anime-card"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-card-long-title.png",
    );
  });
});
