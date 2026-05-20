import { test, expect } from "../../fixtures/extension";

test.describe("Popup Scanning", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("should trigger scan and show progress", async ({ page }) => {
    const scanButton = page.getByRole("button", { name: "Scan Bahamut" });
    await scanButton.click();

    await expect(page.getByText("Scanning...")).toBeVisible();
    await expect(page.locator(".progress-bar")).toBeVisible();
  });
});
