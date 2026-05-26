import { test, expect } from "@playwright/test";

test.describe("AnimeList Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(0, 0);
  });

  test("should match populated active search list snapshot", async ({
    page,
  }) => {
    await page.goto("?component=AnimeList&state=search&isListEmpty=false");
    await expect(
      page.locator('[data-testid="list-container"]'),
    ).toHaveScreenshot("anime-list-populated-search.png");
  });

  test("should match empty search list snapshot", async ({ page }) => {
    await page.goto("?component=AnimeList&state=search&isListEmpty=true");
    await expect(
      page.locator('[data-testid="list-container"]'),
    ).toHaveScreenshot("anime-list-empty-search.png");
  });

  test("should match empty favorites list snapshot", async ({ page }) => {
    await page.goto("?component=AnimeList&state=favorites&isListEmpty=true");
    await expect(
      page.locator('[data-testid="list-container"]'),
    ).toHaveScreenshot("anime-list-empty-favorites.png");
  });
});
