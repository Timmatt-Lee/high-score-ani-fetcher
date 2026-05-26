import { test, expect } from "@playwright/test";

test.describe("AnimeList Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(1000, 1000);
  });

  test("should match populated active search list snapshot", async ({
    page,
  }) => {
    await page.goto("?component=AnimeList&state=search&isListEmpty=false");
    await page.mouse.move(1000, 1000); // Ensure mouse is moved away after page loads
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-list-populated-search.png",
    );
  });

  test("should match empty search list snapshot", async ({ page }) => {
    await page.goto("?component=AnimeList&state=search&isListEmpty=true");
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-list-empty-search.png",
    );
  });

  test("should match empty favorites list snapshot", async ({ page }) => {
    await page.goto("?component=AnimeList&state=favorites&isListEmpty=true");
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "anime-list-empty-favorites.png",
    );
  });
});
