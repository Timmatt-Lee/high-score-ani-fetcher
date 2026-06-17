import { describe, it, expect, vi } from "vitest";

describe("background", () => {
  it("initializes without error", async () => {
    // Set up mock chrome object before importing background
    vi.stubGlobal("chrome", {
      action: { onClicked: { addListener: vi.fn() } },
      runtime: {
        getURL: vi.fn().mockReturnValue("chrome-extension://id/index.html"),
      },
      tabs: { create: vi.fn() },
    });

    // Import the background script to execute it
    await import("./background");

    // We just verify it executes without throwing ReferenceError
    expect(chrome.action.onClicked.addListener).toHaveBeenCalled();
  });
});
