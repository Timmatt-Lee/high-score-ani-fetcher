import { test, expect } from "../../fixtures/extension";

test.describe("Popup Visual Regression", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("visual regression check", async ({ page }) => {
    await expect(page.getByText("AniFetcher Pro")).toBeVisible();
    await expect(page).toHaveScreenshot("popup.png", {
      maxDiffPixels: 100,
    });
  });
});
