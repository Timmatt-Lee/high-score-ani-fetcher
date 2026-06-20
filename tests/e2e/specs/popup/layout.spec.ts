import { test, expect } from "../../fixtures/extension";

test.describe("Popup Layout", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
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
