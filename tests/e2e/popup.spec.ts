import { test, expect } from "./fixtures";

test.describe("Popup UI and Functionality", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Navigate to the extension's popup page
    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("should display initial UI elements", async ({ page }) => {
    // Check header
    await expect(page.getByText("AniFetcher Pro")).toBeVisible();

    // Check tabs
    await expect(page.getByText(/Results/)).toBeVisible();
    await expect(page.getByText(/Favorites/)).toBeVisible();
    await expect(page.getByText(/Trash/)).toBeVisible();

    // Check scan button
    await expect(
      page.getByRole("button", { name: "Scan Bahamut" }),
    ).toBeVisible();

    // Check empty state
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });

  test("should trigger scan and show progress", async ({ page }) => {
    const scanButton = page.getByRole("button", { name: "Scan Bahamut" });
    await scanButton.click();

    // Verify loading state
    await expect(page.getByText("Scanning...")).toBeVisible();
    await expect(page.locator(".progress-bar")).toBeVisible();
  });

  test("should switch between tabs", async ({ page }) => {
    const favTab = page.getByText(/Favorites/);
    const trashTab = page.getByText(/Trash/);
    const resultsTab = page.getByText(/Results/);

    await favTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();

    await trashTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();

    await resultsTab.click();
    await expect(page.getByText("No anime found in this list.")).toBeVisible();
  });

  test("visual regression check", async ({ page }) => {
    // Wait for the main UI to be stable
    await expect(page.getByText("AniFetcher Pro")).toBeVisible();

    // Take a screenshot and compare
    await expect(page).toHaveScreenshot("popup.png", {
      maxDiffPixels: 100,
    });
  });
});
