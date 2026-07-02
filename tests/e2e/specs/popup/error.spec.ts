import { test, expect } from "../../fixtures/extension";

test.describe("Popup Scan Error Handling", () => {
  test.beforeEach(async ({ page, extensionId }) => {
    // Route list page to fail with a 502 status code
    await page.route(
      "https://ani.gamer.com.tw/animeList.php*",
      async (route) => {
        await route.fulfill({
          status: 502,
          contentType: "text/plain",
          body: "Bad Gateway",
        });
      },
    );

    await page.goto(`chrome-extension://${extensionId}/index.html`);
  });

  test("should display fatal error card on scan failure and allow dismissing it", async ({
    page,
  }) => {
    // Verify scan button is present and click it
    const scanButton = page.getByRole("button", { name: "Scan" });
    await scanButton.click();

    // Verify error card is displayed in fatal error container
    const fatalErrorContainer = page.getByTestId("fatal-error-container");
    await expect(fatalErrorContainer).toBeVisible({ timeout: 8000 });

    // Verify error message content
    await expect(
      fatalErrorContainer.getByText("HTTP request failed with status 502"),
    ).toBeVisible();

    // Click dismiss/close button on the error card
    // In our ErrorCard, the button has onDismiss. Let's see what label/role it has.
    // In components/ErrorCard/ErrorCard.tsx, let's see its structure.
    const closeButton = fatalErrorContainer.getByTestId(
      "error-card-dismiss-btn",
    );
    await closeButton.click();

    // Verify error container disappears
    await expect(fatalErrorContainer).not.toBeVisible();
  });
});
