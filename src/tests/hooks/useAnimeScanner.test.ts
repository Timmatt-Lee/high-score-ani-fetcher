import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeScanner } from "../../hooks/useAnimeScanner";
import { ScraperService, type AnimeItem } from "../../services/scraper";

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

  it("scans and calls onScanComplete", async () => {
    const mockAnime = makeAnime("Test");
    vi.spyOn(ScraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(ScraperService, "fetchAllWithConcurrency").mockResolvedValue([
      mockAnime,
    ]);
    vi.spyOn(ScraperService, "scrapeAnimeDetails").mockResolvedValue({
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
});
