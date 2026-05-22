import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeScanner } from "./useAnimeScanner";
import { scraperService, type AnimeItem } from "../services/scraper";

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

describe("useAnimeScanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("scans and calls onScanComplete with filtered results", async () => {
    const mockAnime = makeAnime("Test");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue([
      mockAnime,
    ]);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete));

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([
      { ...mockAnime, score: 9.0, rating_count: 100, description: "x" },
    ]);
    expect(result.current.isScanning).toBe(false);
  });

  // --- Progress callback path (lines 22-24) ---
  it("fires the progress callback from fetchAllWithConcurrency", async () => {
    const mockAnime = makeAnime("ProgressTest");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockImplementation(
      async (_pages, _concurrency, onProgress) => {
        onProgress(50, "halfway");
        return [mockAnime];
      },
    );
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 5.0,
      rating_count: 100,
      description: "x",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete));

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalled();
  });

  // --- Error catch path (lines 53-55) ---
  it("handles scan failure gracefully", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockRejectedValue(
      new Error("network down"),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete));

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).not.toHaveBeenCalled();
    expect(result.current.isScanning).toBe(false);
  });

  it("skips items already in trash or favorites", async () => {
    const trashItem = makeAnime("InTrash");
    const favItem = makeAnime("InFav");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue([
      trashItem,
      favItem,
    ]);

    const onComplete = vi.fn();
    const { result } = renderHook(() =>
      useAnimeScanner([favItem], [trashItem], onComplete),
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("skips items with < 10 episodes, OVA, or non-numeric episode count", async () => {
    const shortShow = makeAnime("Short");
    shortShow.episode_count = "5";

    const ovaShow = makeAnime("OVA Special");
    ovaShow.episode_count = "12";

    const naShow = makeAnime("NAEp");
    naShow.episode_count = "N/A";

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue([
      shortShow,
      ovaShow,
      naShow,
    ]);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete));

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("filters out items with score below 4.8", async () => {
    const lowScore = makeAnime("LowScore");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue([
      lowScore,
    ]);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 4.0,
      rating_count: 10,
      description: "Meh",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete));

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });
});
