import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeScanner } from "./useAnimeScanner";
import { scraperService } from "../services/scraper";
import {
  type AnimeItem,
  type ScraperResult,
  type ScanEvent,
} from "../types/anime";
import { ServiceProvider } from "../contexts/ServiceContext";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
  ScraperUnknownError,
} from "../errors";
import { Observable } from "rxjs";

const makeAnime = (title: string): AnimeItem => ({
  link: `http://${title}`,
  title,
  watchCount: 100,
  episodeCount: 12,
  uploadDate: new Date("2024-01-01"),
  score: 8.5,
  ratingCount: 50,
  description: "Desc",
});

function createMockObservable(
  result: ScraperResult,
  progressEvents: ScanEvent[] = [],
): Observable<ScanEvent> {
  return new Observable<ScanEvent>((subscriber) => {
    for (const event of progressEvents) {
      subscriber.next(event);
    }
    subscriber.next({
      type: "completed",
      result,
    });
    subscriber.complete();
  });
}

describe("useAnimeScanner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("scans and calls onScanComplete with filtered results", async () => {
    const mockAnime = makeAnime("Test");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        if (filterItem(mockAnime)) {
          return createMockObservable(
            {
              items: [
                {
                  ...mockAnime,
                  score: 9.0,
                  ratingCount: 100,
                  description: "x",
                },
              ],
              httpErrors: [],
              parseErrors: [],
            },
            [
              { type: "page_completed", pageNum: 1, success: true },
              {
                type: "detail_completed",
                title: mockAnime.title,
                success: true,
              },
            ],
          );
        }
        return createMockObservable({
          items: [],
          httpErrors: [],
          parseErrors: [],
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [
        { ...mockAnime, score: 9.0, ratingCount: 100, description: "x" },
      ],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("fires the progress callback from scanAllWithPipeline", async () => {
    const mockAnime = makeAnime("ProgressTest");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    const { Subject } = await import("rxjs");
    const subject = new Subject<ScanEvent>();
    vi.spyOn(scraperService, "scanAllWithPipeline").mockReturnValue(subject);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      result.current.handleScan();
    });

    await act(async () => {
      subject.next({ type: "page_completed", pageNum: 1, success: true });
    });
    expect(result.current.progress.message).toContain("Scanning pages (1/1)");

    await act(async () => {
      subject.next({
        type: "detail_completed",
        title: "Halfway",
        success: true,
      });
    });
    expect(result.current.progress.message).toContain("Halfway");

    await act(async () => {
      subject.next({
        type: "completed",
        result: { items: [mockAnime], httpErrors: [], parseErrors: [] },
      });
      subject.complete();
    });

    expect(result.current.progress.message).toBe("Done!");
  });

  it("handles scan failure gracefully", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      new ScraperHttpError("", "network down", 500),
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

  it("includes and updates items already in trash or favorites", async () => {
    const trashItem = makeAnime("InTrash");
    const favItem = makeAnime("InFav");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const items = [trashItem, favItem].filter(filterItem);
        return createMockObservable({
          items: items.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "UpdatedDesc",
          })),
          httpErrors: [],
          parseErrors: [],
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [
        {
          ...favItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
      ],
      updatedTrashList: [
        {
          ...trashItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
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

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const items = [shortShow, ovaShow, naShow].filter(filterItem);
        return createMockObservable({
          items: items.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
          httpErrors: [],
          parseErrors: [],
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("filters out new items with score below 4.8", async () => {
    const lowScore = makeAnime("LowScore");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [
          { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
        ],
        httpErrors: [],
        parseErrors: [],
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("aggregates errors from scanAllWithPipeline", async () => {
    const mockAnime1 = makeAnime("SuccessAnime");
    const pageError = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "http://err-page",
      "Page error",
    );
    const detailError = new ScraperHttpError(
      "http://err-detail",
      "Detail error",
      404,
    );

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [
          {
            ...mockAnime1,
            score: 9.0,
            ratingCount: 100,
            description: "Success",
          },
        ],
        httpErrors: [detailError],
        parseErrors: [pageError],
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [
        { ...mockAnime1, score: 9.0, ratingCount: 100, description: "Success" },
      ],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
    expect(result.current.httpErrors).toHaveLength(1);
    expect(result.current.httpErrors[0]).toBe(detailError);
    expect(result.current.parseErrors).toHaveLength(1);
    expect(result.current.parseErrors[0]).toBe(pageError);
  });

  it("handles ScraperHttpError scan failure in catch block", async () => {
    const error = new ScraperHttpError("http://err", "Failed page", 500);
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBe(error);
  });

  it("handles ScraperParseError scan failure in catch block", async () => {
    const error = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "http://err",
      "Failed page",
    );
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBe(error);
  });

  it("wraps generic Error into ScraperUnknownError when getTotalPages fails with unknown error", async () => {
    const error = new Error("generic error");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      error as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.fatalError?.message).toBe("generic error");
    expect(result.current.httpErrors).toHaveLength(0);
    expect(result.current.parseErrors).toHaveLength(0);
  });

  it("wraps non-Error object into ScraperUnknownError when getTotalPages fails with a string error", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      "string error" as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.fatalError?.message).toBe("string error");
    expect(result.current.httpErrors).toHaveLength(0);
    expect(result.current.parseErrors).toHaveLength(0);
  });

  it("sets fatalError directly without double wrapping when getTotalPages fails with ScraperUnknownError", async () => {
    const error = new ScraperUnknownError(
      new Error("pre-wrapped unknown error"),
    );
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      error as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBe(error);
  });

  it("clears fatalError when clearFatalError is called", async () => {
    const error = new ScraperHttpError("http://err", "Failed", 500);
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBe(error);

    act(() => {
      result.current.clearFatalError();
    });

    expect(result.current.fatalError).toBeNull();
  });

  it("clears fatalError when a new scan starts", async () => {
    const error = new ScraperHttpError("http://err", "Failed", 500);
    vi.spyOn(scraperService, "getTotalPages")
      .mockResolvedValueOnce(error)
      .mockResolvedValueOnce(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [],
        httpErrors: [],
        parseErrors: [],
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.fatalError).toBe(error);

    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.fatalError).toBeNull();
  });

  it("handles progress calculation with zero totalPages or zero detailsTotal", async () => {
    const mockAnime = makeAnime("ZeroProgress");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(0);
    const { Subject } = await import("rxjs");
    const subject = new Subject<ScanEvent>();
    vi.spyOn(scraperService, "scanAllWithPipeline").mockReturnValue(subject);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      result.current.handleScan();
    });

    await act(async () => {
      subject.next({ type: "page_completed", pageNum: 0, success: true });
    });
    expect(result.current.progress.percent).toBe(0);

    await act(async () => {
      subject.next({
        type: "completed",
        result: { items: [mockAnime], httpErrors: [], parseErrors: [] },
      });
      subject.complete();
    });
  });

  it("sorts high-award items by score descending, then title ascending", async () => {
    const itemA = { ...makeAnime("Z_Anime"), score: 9.0 };
    const itemB = { ...makeAnime("A_Anime"), score: 9.0 };
    const itemC = { ...makeAnime("M_Anime"), score: 9.5 };

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [itemA, itemB, itemC],
        httpErrors: [],
        parseErrors: [],
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalled();
    const completedResult = onComplete.mock.calls[0][0];
    expect(completedResult.newSearchItems[0].title).toBe("M_Anime");
    expect(completedResult.newSearchItems[1].title).toBe("A_Anime");
    expect(completedResult.newSearchItems[2].title).toBe("Z_Anime");
  });

  it("skips quality filters for existing fav/trash items", async () => {
    const trashItem = makeAnime("ShortTrash");
    trashItem.episodeCount = 3; // fails episodeCount filter
    const favItem = makeAnime("OVAFav");
    favItem.title = "Something OVA Else"; // fails OVA filter

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(
      (_pages, _pc, _dc, filterItem) => {
        const items = [trashItem, favItem].filter(filterItem);
        return createMockObservable({
          items: items.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "UpdatedDesc",
          })),
          httpErrors: [],
          parseErrors: [],
        });
      },
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [
        {
          ...favItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
      ],
      updatedTrashList: [
        {
          ...trashItem,
          score: 9.0,
          ratingCount: 100,
          description: "UpdatedDesc",
        },
      ],
    });
  });

  it("preserves fav/trash items not found in scan results", async () => {
    const trashItem = makeAnime("NotFoundTrash");
    const favItem = makeAnime("NotFoundFav");

    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return createMockObservable({
        items: [],
        httpErrors: [],
        parseErrors: [],
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [],
      updatedFavoriteList: [favItem],
      updatedTrashList: [trashItem],
    });
  });

  it("handles pipeline errors during scanning by wrapping them in ScraperUnknownError", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.error("pipeline crash");
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.fatalError?.message).toBe("pipeline crash");
    expect(result.current.isScanning).toBe(false);
  });

  it("handles pipeline standard Error during scanning by wrapping it in ScraperUnknownError", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(scraperService, "scanAllWithPipeline").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.error(new Error("pipeline standard error"));
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useAnimeScanner([], [], onComplete), {
      wrapper: ServiceProvider,
    });

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.fatalError).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.fatalError?.message).toBe("pipeline standard error");
  });
});
