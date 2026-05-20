/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, chromium, type BrowserContext } from "@playwright/test";
import path from "path";

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
}>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const pathToExtension = path.join(import.meta.dirname, "../../../dist");
    const context = await chromium.launchPersistentContext("", {
      headless: false, // extensions only work in non-headless mode or new headless mode
      args: [
        `--headless=new`, // required for CI
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });
    await use(context);
    await context.close();
  },
  extensionId: async ({ context }, use) => {
    // Wait for the background service worker to be ready
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent("serviceworker", {
        timeout: 10000,
      });
    }

    const extensionId = background.url().split("/")[2];
    await use(extensionId);
  },
});
export const expect = test.expect;
