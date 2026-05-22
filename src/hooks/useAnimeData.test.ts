import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeData } from "./useAnimeData";
import { type AnimeItem } from "../services/scraper";

const storageMock: Record<string, unknown> = {};

const chromeStorageMock = {
  storage: {
    local: {
      get: vi.fn(async (keys: string[]) => {
        const result: Record<string, unknown> = {};
        keys.forEach((k) => {
          if (storageMock[k]) result[k] = storageMock[k];
        });
        return result;
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(storageMock, data);
      }),
    },
  },
};

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watch_count: 100,
  episode_count: "12",
  upload_date: "2024",
  score: 8.5,
  rating_count: 50,
  description: "Desc",
});

describe("useAnimeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(storageMock).forEach((k) => delete storageMock[k]);
    vi.stubGlobal("chrome", chromeStorageMock);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // --- Chrome storage path ---
  it("loads data from chrome.storage on mount", async () => {
    storageMock["searchList"] = [makeAnime("Test")];
    storageMock["favorites"] = [makeAnime("Fav")];
    storageMock["trash"] = [makeAnime("Trash")];
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(1);
    expect(result.current.searchList[0].title).toBe("Test");
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.trash).toHaveLength(1);
  });

  // --- localStorage fallback path (lines 22-30) ---
  it("falls back to localStorage when chrome is undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    const anime = makeAnime("Local");
    const fav = makeAnime("LocalFav");
    const trashItem = makeAnime("LocalTrash");
    localStorage.setItem(
      "animeData",
      JSON.stringify({
        searchList: [anime],
        favorites: [fav],
        trash: [trashItem],
      }),
    );

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(1);
    expect(result.current.searchList[0].title).toBe("Local");
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.trash).toHaveLength(1);
  });

  it("handles empty localStorage gracefully", async () => {
    vi.stubGlobal("chrome", undefined);
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(0);
  });

  it("handles localStorage data with missing keys using || [] fallback", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem(
      "animeData",
      JSON.stringify({ searchList: [makeAnime("Only")] }),
    );

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(1);
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.trash).toHaveLength(0);
  });

  it("handles localStorage with empty object using || [] fallbacks", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem("animeData", JSON.stringify({}));

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(0);
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.trash).toHaveLength(0);
  });

  // --- Load error path (lines 32-34) ---
  it("handles chrome.storage.get error gracefully", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn().mockRejectedValue(new Error("storage error")),
          set: vi.fn(),
        },
      },
    });

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(0);
  });

  // --- Save via localStorage fallback (lines 48-53) ---
  it("saves via localStorage when chrome is undefined", async () => {
    vi.stubGlobal("chrome", undefined);
    localStorage.setItem(
      "animeData",
      JSON.stringify({
        searchList: [makeAnime("Test")],
        favorites: [],
        trash: [],
      }),
    );

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.moveToFavorites(makeAnime("Test"));
    });

    const saved = JSON.parse(localStorage.getItem("animeData") || "{}");
    expect(saved.favorites).toHaveLength(1);
  });

  // --- Save error path (lines 54-56) ---
  it("handles saveData error gracefully without crashing", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async () => ({ searchList: [makeAnime("Test")] })),
          set: vi.fn().mockRejectedValue(new Error("quota exceeded")),
        },
      },
    });

    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.moveToFavorites(makeAnime("Test"));
    });

    expect(result.current.favorites).toHaveLength(1);
  });

  // --- Core operations ---
  it("moves item to favorites", async () => {
    const anime = makeAnime("Test");
    storageMock["searchList"] = [anime];
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.moveToFavorites(anime);
    });

    expect(result.current.searchList).toHaveLength(0);
    expect(result.current.favorites).toHaveLength(1);
  });

  it("moves item to trash from both search and favorites", async () => {
    const anime = makeAnime("Test");
    storageMock["searchList"] = [anime];
    storageMock["favorites"] = [anime];
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.moveToTrash(anime);
    });

    expect(result.current.searchList).toHaveLength(0);
    expect(result.current.favorites).toHaveLength(0);
    expect(result.current.trash).toHaveLength(1);
  });

  it("restores item from trash back to search", async () => {
    const anime = makeAnime("Test");
    storageMock["trash"] = [anime];
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.restoreFromTrash(anime);
    });

    expect(result.current.trash).toHaveLength(0);
    expect(result.current.searchList).toHaveLength(1);
  });
});
