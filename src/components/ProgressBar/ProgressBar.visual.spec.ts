import { test, expect } from "@playwright/test";

test.describe("ProgressBar Visual Regression", () => {
  test.beforeEach(async ({ page }) => {
    await page.mouse.move(1000, 1000);
  });

  test("should match in-progress scanning state snapshot", async ({ page }) => {
    await page.goto(
      "?component=ProgressBar&isScanning=true&percent=50&message=Scanning%20page%205%20of%2010...",
    );
    await page
      .locator('[data-testid="progress-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "progress-bar-in-progress.png",
    );
  });

  test("should match start scanning state snapshot", async ({ page }) => {
    await page.goto(
      "?component=ProgressBar&isScanning=true&percent=0&message=Initializing%20scanner...",
    );
    await page
      .locator('[data-testid="progress-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "progress-bar-start.png",
    );
  });

  test("should match completed scanning state snapshot", async ({ page }) => {
    await page.goto(
      "?component=ProgressBar&isScanning=true&percent=100&message=Scan%20finished!",
    );
    await page
      .locator('[data-testid="progress-container"]')
      .waitFor({ state: "visible" });
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(1000, 1000);
    await expect(page.locator("#playground-root")).toHaveScreenshot(
      "progress-bar-completed.png",
    );
  });

  test("should be hidden when isScanning is false", async ({ page }) => {
    await page.goto("?component=ProgressBar&isScanning=false");
    await expect(
      page.locator('[data-testid="progress-container"]'),
    ).toBeHidden();
  });
});
