import { test, expect } from "../../fixtures/extension";
import path from "path";
import fs from "fs";

test.describe("Popup Settings Tab", () => {
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
    // Setup network mocking
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

  test("should render setting inputs and save settings changes", async ({
    page,
  }) => {
    // Navigate to Settings
    await page.getByTestId("tab-settings").click();
    await expect(page.getByTestId("settings-tab")).toBeVisible();

    // Verify Target Score input exists and change it
    const targetScoreInput = page.locator('input[type="number"]').first();
    await expect(targetScoreInput).toHaveValue("4.8");

    await targetScoreInput.fill("5.0");
    await expect(targetScoreInput).toHaveValue("5.0");
  });

  test("should filter scanned list dynamically when Target Score changes", async ({
    page,
  }) => {
    // First, scan to get some anime
    await page.getByRole("button", { name: "Scan" }).click();

    // Wait for mock cards to render
    const firstCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "測試動畫第一季" }); // rating 4.9
    const secondCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "垃圾桶動畫" }); // rating 4.9
    await expect(firstCard).toBeVisible({ timeout: 8000 });
    await expect(secondCard).toBeVisible();

    // Navigate to Settings and change Target Score to 5.0
    await page.getByTestId("tab-settings").click();
    const targetScoreInput = page.locator('input[type="number"]').first();
    await targetScoreInput.fill("5.0");

    // Go back to Results tab
    await page.getByTestId("tab-scanned").click();

    // Verify both items (score 4.9) are filtered out because target score is 5.0
    await expect(page.getByText("No anime found in this list.")).toBeVisible();

    // Go back to Settings and change Target Score to 4.5
    await page.getByTestId("tab-settings").click();
    await targetScoreInput.fill("4.5");

    // Go back to Results tab
    await page.getByTestId("tab-scanned").click();

    // Verify they are visible again
    await expect(firstCard).toBeVisible();
    await expect(secondCard).toBeVisible();
  });

  test("should export and import backup data successfully", async ({
    page,
  }) => {
    // Populate some data first
    await page.getByRole("button", { name: "Scan" }).click();
    const firstCard = page
      .getByTestId("anime-card")
      .filter({ hasText: "測試動畫第一季" });
    await expect(firstCard).toBeVisible({ timeout: 8000 });

    // Navigate to Settings
    await page.getByTestId("tab-settings").click();

    // Test Export
    const downloadPromise = page.waitForEvent("download");
    await page.getByTestId("btn-export-backup").click();
    const download = await downloadPromise;

    // Verify download exists
    expect(download.suggestedFilename()).toContain(
      "high-score-ani-fetcher-backup",
    );
    const downloadPath = path.join(
      import.meta.dirname,
      "../../../scratch/temp-backup.json",
    );
    await download.saveAs(downloadPath);

    // Verify file content is valid JSON
    const exportedData = JSON.parse(fs.readFileSync(downloadPath, "utf-8"));
    expect(exportedData.scannedList.length).toBeGreaterThan(0);

    // Delete existing data by importing a clean/empty database
    const emptyBackup = {
      version: 1,
      scannedList: [],
      favoriteList: [
        {
          link: "https://ani.gamer.com.tw/animeVideo.php?sn=12345",
          title: "匯入測試動畫",
          score: 5.0,
          ratingCount: 1000,
          description: "這是一個測試動畫",
          watchCount: 99999,
          episodeCount: 12,
          uploadDate: "2026-07-01",
          coverUrl: "https://example.com/cover.jpg",
          genres: ["冒險"],
          updatedAt: new Date().toISOString(),
        },
      ],
      trashList: [],
    };

    const importPath = path.join(
      import.meta.dirname,
      "../../../scratch/temp-import.json",
    );
    fs.mkdirSync(path.dirname(importPath), { recursive: true });
    fs.writeFileSync(importPath, JSON.stringify(emptyBackup, null, 2), "utf-8");

    // Upload the import file
    await page.getByTestId("file-import-input").setInputFiles(importPath);

    // Verify imported item appears in Favorites tab
    await page.getByTestId("tab-favorites").click();
    await expect(page.getByText("匯入測試動畫")).toBeVisible();

    // Clean up temporary files
    try {
      fs.unlinkSync(downloadPath);
      fs.unlinkSync(importPath);
    } catch (e) {
      console.warn("Could not clean up temporary backup files:", e);
    }
  });
});
