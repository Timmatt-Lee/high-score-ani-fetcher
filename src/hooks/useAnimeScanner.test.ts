import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnimeScanner } from "./useAnimeScanner";
import { animeScanner } from "../services/animeScanner/animeScanner";
import { ServiceProvider } from "../contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanStep,
  AnimeScanner,
} from "../services/animeScanner";
import { type AnimeItem } from "../services/animeScanner/types";

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watchCount: 100,
  episodeCount: 12,
  uploadDate: "2024-01-01T00:00:00.000Z",
  score: 8.5,
  ratingCount: 50,
  description: "Desc",
});

describe("useAnimeScanner hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("scans and calls onScanUpdate with filtered results", async () => {
    const mockAnime = makeAnime("Test");
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      mockAnime,
    ]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        options.onDetailScanned({
          ...mockAnime,
          score: 9.0,
          ratingCount: 100,
          description: "x",
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [
        { ...mockAnime, score: 9.0, ratingCount: 100, description: "x" },
      ],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("fires progress callback and completes successfully", async () => {
    const mockAnime = makeAnime("ProgressTest");
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockImplementation(
      async (options) => {
        options.onPageScanned(1, [mockAnime]);
        return [mockAnime];
      },
    );
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        options.onDetailScanned({
          ...mockAnime,
          score: 9.0,
          ratingCount: 100,
          description: "x",
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.progress.message).toBe("Done!");
    expect(result.current.progress.percent).toBe(100);
  });

  it("handles scan failure gracefully when getTotalPages throws", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "",
      "network down",
      500,
      undefined,
    );
    vi.spyOn(animeScanner, "getTotalPages").mockRejectedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.error).toBe(error);
  });

  it("updates items already in trash or favorites", async () => {
    const trashItem = makeAnime("InTrash");
    const favItem = makeAnime("InFav");
    const trashItem2 = makeAnime("InTrash2");
    trashItem2.link = "http://InTrash2";
    const favItem2 = makeAnime("InFav2");
    favItem2.link = "http://InFav2";

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      trashItem,
      favItem,
    ]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        for (const item of options.items) {
          options.onDetailScanned({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "UpdatedDesc",
          } as AnimeItem);
        }
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useAnimeScanner(
          [],
          [favItem, favItem2],
          [trashItem, trashItem2],
          onComplete,
        ),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [],
      updatedFavoriteList: [
        {
          ...favItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
        favItem2,
      ],
      updatedTrashList: [
        {
          ...trashItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
        trashItem2,
      ],
    });
  });

  it("skips new items with < 10 episodes, OVA, or non-numeric episode count", async () => {
    const shortShow = makeAnime("Short");
    shortShow.episodeCount = 5;

    const ovaShow = makeAnime("OVA Special");
    ovaShow.episodeCount = 12;

    const naShow = makeAnime("NAEp");
    naShow.episodeCount = NaN;

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      shortShow,
      ovaShow,
      naShow,
    ]);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("saves new items even with score below target score to ensure caching works", async () => {
    const lowScore = makeAnime("LowScore");
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([lowScore]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        options.onDetailScanned({
          ...lowScore,
          score: 4.0,
          ratingCount: 10,
          description: "Meh",
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [
        { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
      ],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("handles non-Error objects thrown by getTotalPages", async () => {
    vi.spyOn(animeScanner, "getTotalPages").mockRejectedValue("string error");
    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error?.message).toBe("string error");
  });

  it("cancels scanning when cancelScan is called", async () => {
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockImplementation(
      async (options) => {
        return new Promise((_, reject) => {
          const checkAbort = () => {
            if (options.signal?.aborted) {
              reject(new DOMException("Scan aborted by user", "AbortError"));
            } else {
              setTimeout(checkAbort, 5);
            }
          };
          checkAbort();
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    act(() => {
      result.current.handleScan();
    });

    expect(result.current.isScanning).toBe(true);

    act(() => {
      result.current.cancelScan();
    });

    await waitFor(() => {
      expect(result.current.isScanning).toBe(false);
    });
  });

  it("skips scan for cached items with low score (expired cache)", async () => {
    const lowScoreItem = makeAnime("LowScoreItem");
    lowScoreItem.score = 4.0; // below threshold (4.8 * 95% = 4.56)
    // Set scannedAt to 15 days ago so the freshness check does NOT short-circuit
    lowScoreItem.scannedAt = new Date(
      Date.now() - 15 * 24 * 60 * 60 * 1000,
    ).toISOString();

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      lowScoreItem,
    ]);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([lowScoreItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    // lowScoreItem is skipped by isScanRequired (score < threshold after expired cache),
    // so no scanAnimeDetails is called. The original scannedList is returned as-is.
    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [lowScoreItem],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("skips scan for cached items with fresh scannedAt date", async () => {
    const freshItem = makeAnime("FreshItem");
    freshItem.score = 4.9;
    freshItem.scannedAt = new Date().toISOString();

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      freshItem,
    ]);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([freshItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it("rescans expired items", async () => {
    const expiredItem = makeAnime("ExpiredItem");
    expiredItem.score = 4.9;
    expiredItem.scannedAt = new Date(
      Date.now() - 15 * 24 * 60 * 60 * 1000,
    ).toISOString();

    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      expiredItem,
    ]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockImplementation(
      async (options) => {
        options.onDetailScanned({
          ...expiredItem,
          score: 4.95,
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([expiredItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      updatedScannedList: [{ ...expiredItem, score: 4.95 }],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("clearError resets the error state", async () => {
    vi.spyOn(animeScanner, "getTotalPages").mockRejectedValue(
      new Error("fail"),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeDefined();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("handles scanAnimeDetails rejection as pipeline error", async () => {
    const mockAnime = makeAnime("PipelineErr");
    vi.spyOn(animeScanner, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scanPages").mockResolvedValue([
      mockAnime,
    ]);
    vi.spyOn(AnimeScanner.prototype, "scanAnimeDetails").mockRejectedValue(
      new Error("details failed"),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error?.message).toBe("details failed");
  });
});
