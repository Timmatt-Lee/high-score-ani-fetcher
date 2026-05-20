import { test, expect } from "./fixtures";

test("popup page visual regression test", async ({ page, extensionId }) => {
  // Navigate to the extension's popup page
  await page.goto(`chrome-extension://${extensionId}/index.html`);

  // Wait for the main UI to render (e.g., the scan button)
  // Assuming there's a button, we wait for it to ensure the page has loaded
  await expect(page.locator("button").first()).toBeVisible();

  // Take a screenshot and compare
  await expect(page).toHaveScreenshot("popup.png", {
    maxDiffPixels: 100,
  });
});
