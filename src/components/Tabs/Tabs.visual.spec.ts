import { test, expect } from "@playwright/test";

test.describe("Tabs Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(0, 0);
  });

  test("should match search tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=search&searchCount=12&favoritesCount=5&trashCount=2",
    );
    await expect(
      page.locator('[data-testid="tabs-container"]'),
    ).toHaveScreenshot("tabs-search-active.png");
  });

  test("should match favorites tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=favorites&searchCount=0&favoritesCount=0&trashCount=0",
    );
    await expect(
      page.locator('[data-testid="tabs-container"]'),
    ).toHaveScreenshot("tabs-favorites-active.png");
  });

  test("should match trash tab active state snapshot", async ({ page }) => {
    await page.goto(
      "?component=Tabs&state=trash&searchCount=99&favoritesCount=42&trashCount=7",
    );
    await expect(
      page.locator('[data-testid="tabs-container"]'),
    ).toHaveScreenshot("tabs-trash-active.png");
  });
});
