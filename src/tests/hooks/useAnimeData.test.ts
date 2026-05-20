import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeData } from "../../hooks/useAnimeData";
import { type AnimeItem } from "../../services/scraper";

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

  it("loads data on mount", async () => {
    storageMock["searchList"] = [makeAnime("Test")];
    const { result } = renderHook(() => useAnimeData());

    // Wait for the async useEffect to complete
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.searchList).toHaveLength(1);
    expect(result.current.searchList[0].title).toBe("Test");
  });

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
    expect(storageMock["favorites"]).toBeDefined();
  });

  it("moves item to trash", async () => {
    const anime = makeAnime("Test");
    storageMock["searchList"] = [anime];
    const { result } = renderHook(() => useAnimeData());

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    await act(async () => {
      result.current.moveToTrash(anime);
    });

    expect(result.current.searchList).toHaveLength(0);
    expect(result.current.trash).toHaveLength(1);
    expect(storageMock["trash"]).toBeDefined();
  });

  it("restores item from trash", async () => {
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
    expect(storageMock["searchList"]).toBeDefined();
  });
});
