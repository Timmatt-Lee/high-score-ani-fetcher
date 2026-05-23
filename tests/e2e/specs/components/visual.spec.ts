import { test, expect } from "@playwright/test";

test.describe("Component-Level Visual Regression", () => {
  test("should match visual screenshot for AnimeCard states", async ({
    page,
  }) => {
    await page.goto("/?test-component=AnimeCard");
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "component-anime-card.png",
    );
  });

  test("should match visual screenshot for ProgressBar states", async ({
    page,
  }) => {
    await page.goto("/?test-component=ProgressBar");
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "component-progress-bar.png",
    );
  });

  test("should match visual screenshot for Tabs states", async ({ page }) => {
    await page.goto("/?test-component=Tabs");
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "component-tabs.png",
    );
  });

  test("should match visual screenshot for AnimeList states", async ({
    page,
  }) => {
    await page.goto("/?test-component=AnimeList");
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "component-anime-list.png",
    );
  });
});
