import { test, expect } from "@playwright/test";

test.describe("AnimeCard Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    // Reset mouse to (0,0) to prevent accidental hovers on links or buttons
    await page.mouse.move(0, 0);
  });

  test("should match search tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=search");
    await expect(page.locator('[data-testid="anime-card"]')).toHaveScreenshot(
      "anime-card-search.png",
    );
  });

  test("should match favorites tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=favorites");
    await expect(page.locator('[data-testid="anime-card"]')).toHaveScreenshot(
      "anime-card-favorites.png",
    );
  });

  test("should match trash tab state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=trash");
    await expect(page.locator('[data-testid="anime-card"]')).toHaveScreenshot(
      "anime-card-trash.png",
    );
  });

  test("should match long title wrapping state snapshot", async ({ page }) => {
    await page.goto("?component=AnimeCard&state=long-title");
    await expect(page.locator('[data-testid="anime-card"]')).toHaveScreenshot(
      "anime-card-long-title.png",
    );
  });
});
