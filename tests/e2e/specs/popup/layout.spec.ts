import { test, expect } from "../../fixtures/extension";

test.describe("Popup Layout", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("should display initial UI elements", async ({ page }) => {
    await expect(page.getByText("巴哈動畫評分")).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan" })).toBeVisible();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });

  test("should switch between tabs", async ({ page }) => {
    const favTab = page.getByRole("button").filter({ hasText: /Favorites/ });
    const resultsTab = page.getByRole("button").filter({ hasText: /Results/ });

    await favTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();

    await resultsTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });
});
