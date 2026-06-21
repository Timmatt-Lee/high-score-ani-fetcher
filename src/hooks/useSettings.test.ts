import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSettings } from "./useSettings";

describe("useSettings", () => {
  const defaultSettings = {
    targetScore: 4.8,
    rescanThreshold: 95,
    cacheExpireDays: 14,
    requestDelayMs: 800,
  };

  const mockSettings = {
    targetScore: 4.9,
    rescanThreshold: 90,
    cacheExpireDays: 7,
    requestDelayMs: 800,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads default settings when nothing is stored", async () => {
    const { result } = renderHook(() => useSettings());

    // Wait for the async load
    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(defaultSettings);
  });

  it("loads settings from chrome.storage", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ settings: mockSettings }),
        },
      },
    });

    const { result } = renderHook(() => useSettings());

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(mockSettings);
  });

  it("loads settings from localStorage when chrome.storage is unavailable", async () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(JSON.stringify(mockSettings)),
    });

    const { result } = renderHook(() => useSettings());

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(mockSettings);
  });

  it("handles parse error gracefully from chrome.storage", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi
            .fn()
            .mockResolvedValue({ settings: { targetScore: "invalid" } }),
        },
      },
    });

    const { result } = renderHook(() => useSettings());

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(defaultSettings);
  });

  it("handles parse error gracefully from localStorage", async () => {
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("localStorage", {
      getItem: vi
        .fn()
        .mockReturnValue(JSON.stringify({ targetScore: "invalid" })),
    });

    const { result } = renderHook(() => useSettings());

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(defaultSettings);
  });

  it("handles load error gracefully", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error("load failed")),
        },
      },
    });

    const { result } = renderHook(() => useSettings());

    await vi.waitFor(() => {
      expect(result.current.isLoaded).toBe(true);
    });

    expect(result.current.settings).toEqual(defaultSettings);
    expect(console.error).toHaveBeenCalledWith(
      "Failed to load settings",
      expect.any(Error),
    );
  });

  it("saves settings to chrome.storage", async () => {
    const mockSet = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: mockSet,
        },
      },
    });

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.saveSettings(mockSettings);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(mockSet).toHaveBeenCalledWith({ settings: mockSettings });
  });

  it("saves settings to localStorage when chrome.storage is unavailable", async () => {
    const mockSetItem = vi.fn();
    vi.stubGlobal("chrome", undefined);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: mockSetItem,
    });

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.saveSettings(mockSettings);
    });

    expect(result.current.settings).toEqual(mockSettings);
    expect(mockSetItem).toHaveBeenCalledWith(
      "settings",
      JSON.stringify(mockSettings),
    );
  });

  it("handles save error gracefully", async () => {
    const mockSet = vi.fn().mockRejectedValue(new Error("save failed"));
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: mockSet,
        },
      },
    });

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await result.current.saveSettings(mockSettings);
    });

    expect(console.error).toHaveBeenCalledWith(
      "Failed to save settings",
      expect.any(Error),
    );
  });
});
