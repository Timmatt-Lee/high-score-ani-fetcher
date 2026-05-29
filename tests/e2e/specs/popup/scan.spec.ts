import { test, expect } from "../../fixtures/extension";
import path from "path";
import fs from "fs";

test.describe("Popup Scanning & Interaction", () => {
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

  test.beforeEach(async ({ page, extensionId }) => {
    // Setup network mocking for 巴哈姆特動漫瘋
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

    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("should scan and display mocked results", async ({ page }) => {
    const scanButton = page.getByRole("button", {
      name: "Scan 巴哈姆特動漫瘋",
    });
    await scanButton.click();

    // Verify results are rendered (from our mock)
    await expect(page.getByText("測試動畫第一季")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("垃圾桶動畫")).toBeVisible();
    await expect(page.getByText("★ 4.9")).toHaveCount(2);
  });

  test("should handle favorite and trash workflow", async ({ page }) => {
    await page.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }).click();

    // Wait for the card to be fully rendered
    const firstCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "測試動畫第一季" });
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    // Add to Favorites
    await firstCard.getByRole("button", { name: "Favorite" }).click();

    // Verify in Favorites tab
    await page.getByRole("button", { name: /Favorites/ }).click();
    await expect(
      page.getByTestId("list-container").getByText("測試動畫第一季"),
    ).toBeVisible();

    // Move to Trash
    const favCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "測試動畫第一季" });
    await favCard.getByRole("button", { name: "Trash" }).click();

    // Verify in Trash tab
    await page.getByRole("button", { name: /Trash/ }).click();
    await expect(
      page.getByTestId("list-container").getByText("測試動畫第一季"),
    ).toBeVisible();
  });

  test("should persist data after reload", async ({ page }) => {
    await page.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }).click();
    const firstCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "測試動畫第一季" });
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    await firstCard.getByRole("button", { name: "Favorite" }).click();

    // Reload page
    await page.reload();
    await page.waitForLoadState("domcontentloaded");

    // Check if still in Favorites
    await page.getByRole("button", { name: /Favorites/ }).click();
    await expect(
      page.getByTestId("list-container").getByText("測試動畫第一季"),
    ).toBeVisible();
  });
});
