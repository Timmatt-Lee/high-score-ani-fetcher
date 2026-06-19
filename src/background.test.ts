import { describe, it, expect, vi } from "vitest";

describe("background", () => {
  it("initializes and handles extension click (new tab)", async () => {
    let clickListener: () => void;
    vi.stubGlobal("chrome", {
      action: {
        onClicked: {
          addListener: vi.fn((cb) => {
            clickListener = cb;
          }),
        },
      },
      runtime: {
        getURL: vi.fn().mockReturnValue("chrome-extension://id/index.html"),
      },
      tabs: {
        create: vi.fn(),
        query: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      windows: { update: vi.fn() },
    });

    await import("./background");

    // Trigger the click
    await clickListener!();

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: "chrome-extension://id/index.html",
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: "chrome-extension://id/index.html",
    });
  });

  it("handles extension click (existing tab)", async () => {
    let clickListener: () => void;
    vi.stubGlobal("chrome", {
      action: {
        onClicked: {
          addListener: vi.fn((cb) => {
            clickListener = cb;
          }),
        },
      },
      runtime: {
        getURL: vi.fn().mockReturnValue("chrome-extension://id/index.html"),
      },
      tabs: {
        create: vi.fn(),
        query: vi.fn().mockResolvedValue([{ id: 123, windowId: 456 }]),
        update: vi.fn(),
      },
      windows: { update: vi.fn() },
    });

    vi.resetModules();
    await import("./background");

    await clickListener!();

    expect(chrome.tabs.query).toHaveBeenCalledWith({
      url: "chrome-extension://id/index.html",
    });
    expect(chrome.tabs.update).toHaveBeenCalledWith(123, { active: true });
    expect(chrome.windows.update).toHaveBeenCalledWith(456, { focused: true });
    expect(chrome.tabs.create).not.toHaveBeenCalled();
  });
});
