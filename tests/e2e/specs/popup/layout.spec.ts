import { test, expect } from "../../fixtures/extension";

test.describe("Popup Layout", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    // Seed trashList with an item to prevent auto-scan during layout/tab-switching tests
    await page.evaluate(async () => {
      const mockItem = {
        link: "http://dummy",
        title: "Dummy Anime",
        watchCount: 100,
        episodeCount: 12,
        uploadDate: new Date().toISOString(),
        score: 4.8,
        ratingCount: 10,
        description: "Dummy description",
      };
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({
          searchList: [],
          favoriteList: [],
          trashList: [mockItem],
        });
      } else {
        localStorage.setItem(
          "animeData",
          JSON.stringify({
            searchList: [],
            favoriteList: [],
            trashList: [mockItem],
          }),
        );
      }
    });
    await page.reload();
  });

  test("should display initial UI elements", async ({ page }) => {
    await expect(page.getByText("AniFetcher Pro")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Scan 巴哈姆特動漫瘋" }),
    ).toBeVisible();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });

  test("should switch between tabs", async ({ page }) => {
    const favTab = page.getByText(/Favorites/);
    const resultsTab = page.getByText(/Results/);

    await favTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();

    await resultsTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });
});
