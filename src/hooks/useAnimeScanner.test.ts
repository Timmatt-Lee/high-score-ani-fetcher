import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeScanner } from "./useAnimeScanner";
import { scraperService } from "../services/scraper";
import { type AnimeItem } from "../types/anime";
import { ServiceProvider } from "../contexts/ServiceContext";
import { ScraperHttpError } from "../types/errors";

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watch_count: 100,
  episode_count: 12,
  upload_date: new Date("2024-01-01"),
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
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [mockAnime],
      errors: [],
    });
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([
      { ...mockAnime, score: 9, rating_count: 100, description: "x" },
    ]);
  });

  it("fires the progress callback from fetchAllWithConcurrency", async () => {
    const mockAnime = makeAnime("ProgressTest");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockImplementation(
      async (_pages, _concurrency, onProgress) => {
        onProgress(50, "Halfway");
        return { items: [mockAnime], errors: [] };
      },
    );
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.0,
      rating_count: 100,
      description: "x",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.progress.message).toBe(""); // Reset at end
  });

  // --- Error catch path (lines 53-55) ---
  it("handles scan failure gracefully", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockRejectedValue(
      new Error("network down"),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("skips items already in trash or favorites", async () => {
    const trashItem = makeAnime("InTrash");
    const favItem = makeAnime("InFav");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [trashItem, favItem],
      errors: [],
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("skips items with < 10 episodes, OVA, or non-numeric episode count", async () => {
    const shortShow = makeAnime("Short");
    shortShow.episode_count = 5;

    const ovaShow = makeAnime("OVA Special");
    ovaShow.episode_count = 12;

    const naShow = makeAnime("NAEp");
    naShow.episode_count = NaN;

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [shortShow, ovaShow, naShow],
      errors: [],
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("filters out items with score below 4.8", async () => {
    const lowScore = makeAnime("LowScore");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [lowScore],
      errors: [],
    });
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 4.0,
      rating_count: 10,
      description: "Meh",
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
  });

  it("aggregates errors from fetchAllWithConcurrency and scrapeAnimeDetails", async () => {
    const mockAnime1 = makeAnime("SuccessAnime");
    const mockAnime2 = makeAnime("FailDetailAnime");
    const pageError = new ScraperHttpError(
      "http://err-page",
      "Page error",
      500,
    );
    const detailError = new ScraperHttpError(
      "http://err-detail",
      "Detail error",
      404,
    );

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [mockAnime1, mockAnime2],
      errors: [pageError],
    });

    vi.spyOn(scraperService, "scrapeAnimeDetails").mockImplementation(
      async (link) => {
        if (link === mockAnime1.link) {
          return { score: 9.0, rating_count: 100, description: "Success" };
        }
        throw detailError;
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([
      { ...mockAnime1, score: 9.0, rating_count: 100, description: "Success" },
    ]);
    expect(result.current.errors).toHaveLength(2);
    expect(result.current.errors[0]).toBe(pageError);
    expect(result.current.errors[1]).toBe(detailError);
  });

  it("wraps generic details errors as ScraperHttpError", async () => {
    const mockAnime = makeAnime("GenericErrorAnime");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [mockAnime],
      errors: [],
    });

    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      new Error("Generic Network Error"),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((result.current.errors[0] as ScraperHttpError).html).toBe(
      "Generic Network Error",
    );
  });

  it("handles ScraperHttpError scan failure in catch block", async () => {
    const error = new ScraperHttpError("http://err", "Failed page", 500);
    vi.spyOn(scraperService, "getTotalPages").mockRejectedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toBe(error);
  });

  it("handles non-Error thrown during scan in catch block", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockRejectedValue("string error");

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((result.current.errors[0] as ScraperHttpError).html).toBe(
      "string error",
    );
  });

  it("wraps non-Error detail failure as ScraperHttpError", async () => {
    const mockAnime = makeAnime("NonErrorDetailAnime");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "fetchAllWithConcurrency").mockResolvedValue({
      items: [mockAnime],
      errors: [],
    });

    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      "Detail string error",
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith([]);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((result.current.errors[0] as ScraperHttpError).html).toBe(
      "Detail string error",
    );
  });
});
