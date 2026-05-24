import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Popup Visual Regression", () => {
  let listHtml: string;
  let detailHtml: string;

  test.beforeAll(() => {
    const listMockPath = path.join(
      import.meta.dirname,
      "../../fixtures/mocks/ani_gamer.html",
    );
    const detailMockPath = path.join(
      import.meta.dirname,
      "../../fixtures/mocks/ani_gamer_details.html",
    );
    listHtml = fs.readFileSync(listMockPath, "utf-8");
    detailHtml = fs.readFileSync(detailMockPath, "utf-8");
  });

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Reset mouse to (0, 0) to avoid accidental hover states on popup elements
    await page.mouse.move(0, 0);
  });

  test("should match visual snapshot for initial state", async ({ page }) => {
    await expect(page.getByText("AniFetcher Pro")).toBeVisible();
    await expect(
      page.locator('[data-testid="app-container"]'),
    ).toHaveScreenshot("popup-initial.png");
  });

  test("should match visual snapshot for scanning state", async ({ page }) => {
    // Mock anime list endpoint with a 3-second delay to capture scanning state
    await page.route(
      "https://ani.gamer.com.tw/animeList.php*",
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: listHtml,
        });
      },
    );

    await page.route(
      "https://ani.gamer.com.tw/animeVideo.php*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: detailHtml,
        });
      },
    );

    // Click scan to transition to scanning state
    await page.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }).click();

    // Verify loading indicator/progress is visible before screenshot
    await expect(
      page.getByRole("button", { name: "Scanning..." }),
    ).toBeVisible();

    // Take screenshot of scanning state
    await expect(
      page.locator('[data-testid="app-container"]'),
    ).toHaveScreenshot("popup-scanning.png");
  });

  test("should match visual snapshot for results state", async ({ page }) => {
    // Instant fulfillment
    await page.route(
      "https://ani.gamer.com.tw/animeList.php*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: listHtml,
        });
      },
    );

    await page.route(
      "https://ani.gamer.com.tw/animeVideo.php*",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: detailHtml,
        });
      },
    );

    // Click scan
    await page.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }).click();

    // Wait for the mock results cards to appear
    await expect(page.getByText("測試動畫第一季")).toBeVisible({
      timeout: 15000,
    });

    // Take screenshot of the populated result state
    await expect(
      page.locator('[data-testid="app-container"]'),
    ).toHaveScreenshot("popup-results.png");
  });
});
