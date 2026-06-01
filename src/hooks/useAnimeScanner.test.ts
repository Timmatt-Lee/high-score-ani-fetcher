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
  ScraperScanStep,
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
      new ScraperHttpError(1, "", "network down", 500),
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
      () => useAnimeScanner([], [favItem], [trashItem], onComplete),
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
      1,
      ScraperScanStep.TITLE,
      "http://err-page",
      "Page error",
    );
    const detailError = new ScraperHttpError(
      1,
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
    const error = new ScraperHttpError(1, "http://err", "Failed page", 500);
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBe(error);
  });

  it("handles ScraperParseError scan failure in catch block", async () => {
    const error = new ScraperParseError(
      1,
      ScraperScanStep.TITLE,
      "http://err",
      "Failed page",
    );
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBe(error);
  });

  it("wraps generic Error into ScraperUnknownError when getTotalPages fails with unknown error", async () => {
    const error = new Error("generic error");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      error as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.error?.message).toBe("generic error");
    expect(result.current.httpErrors).toHaveLength(0);
    expect(result.current.parseErrors).toHaveLength(0);
  });

  it("wraps non-Error object into ScraperUnknownError when getTotalPages fails with a string error", async () => {
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      "string error" as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.error?.message).toBe("string error");
    expect(result.current.httpErrors).toHaveLength(0);
    expect(result.current.parseErrors).toHaveLength(0);
  });

  it("sets error directly without double wrapping when getTotalPages fails with ScraperUnknownError", async () => {
    const error = new ScraperUnknownError(
      new Error("pre-wrapped unknown error"),
    );
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(
      error as unknown as ScraperHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBe(error);
  });

  it("clears error when clearError is called", async () => {
    const error = new ScraperHttpError(1, "http://err", "Failed", 500);
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBe(error);

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("clears error when a new scan starts", async () => {
    const error = new ScraperHttpError(1, "http://err", "Failed", 500);
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.error).toBe(error);

    await act(async () => {
      await result.current.handleScan();
    });
    expect(result.current.error).toBeNull();
  });

  it("handles progress calculation with zero totalPages or zero detailsTotal", async () => {
    const mockAnime = makeAnime("ZeroProgress");
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(0);
    const { Subject } = await import("rxjs");
    const subject = new Subject<ScanEvent>();
    vi.spyOn(scraperService, "scanAllWithPipeline").mockReturnValue(subject);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

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
      () => useAnimeScanner([], [favItem], [trashItem], onComplete),
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
      () => useAnimeScanner([], [favItem], [trashItem], onComplete),
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.error?.message).toBe("pipeline crash");
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
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(ScraperUnknownError);
    expect(result.current.error?.message).toBe("pipeline standard error");
  });

  it("handles retry scans by pre-populating merged items map and bypassing total page fetch", async () => {
    const searchItem = makeAnime("SearchItem");
    const favItem = makeAnime("FavItem");
    const trashItem = makeAnime("TrashItem");

    const pipelineSpy = vi
      .spyOn(scraperService, "scanAllWithPipeline")
      .mockImplementation(() => {
        return createMockObservable(
          {
            items: [{ ...searchItem, score: 9.0 }],
            httpErrors: [],
            parseErrors: [],
          },
          [
            {
              type: "page_completed",
              pageNum: 3,
              success: true,
            },
          ],
        );
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([searchItem], [favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    // Call handleScan with retry options
    await act(async () => {
      await result.current.handleScan({
        failedPages: [3],
        failedDetails: [searchItem],
      });
    });

    // Check that getTotalPages was not called
    const pagesSpy = vi.spyOn(scraperService, "getTotalPages");
    expect(pagesSpy).not.toHaveBeenCalled();

    // Check that scanAllWithPipeline was called with option args
    expect(pipelineSpy).toHaveBeenCalledWith(
      0, // totalPages defaults to 0 since we didn't fetch it, but retry option page list is used
      5,
      10,
      expect.any(Function),
      {
        failedPages: [3],
        failedDetails: [searchItem],
      },
    );

    expect(onComplete).toHaveBeenCalled();
  });

  it("handles empty options object as non-retry and detail-only retry branch conditions", async () => {
    // 1. Empty options should be treated as non-retry
    vi.spyOn(scraperService, "getTotalPages").mockResolvedValue(2);
    const pipelineSpy = vi
      .spyOn(scraperService, "scanAllWithPipeline")
      .mockImplementation(() => {
        return createMockObservable(
          {
            items: [],
            httpErrors: [],
            parseErrors: [],
          },
          [
            {
              type: "detail_completed",
              title: "Mocking Progress Details",
              success: true,
            },
          ],
        );
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan({}); // empty options
    });

    expect(pipelineSpy).toHaveBeenLastCalledWith(
      2,
      5,
      10,
      expect.any(Function),
      undefined,
    );

    // 2. Retry with failedDetails but no failedPages (failedPages is falsy/undefined)
    const detailItem = makeAnime("DetailItem");
    await act(async () => {
      await result.current.handleScan({
        failedDetails: [detailItem],
      });
    });

    expect(pipelineSpy).toHaveBeenLastCalledWith(
      2,
      5,
      10,
      expect.any(Function),
      { failedDetails: [detailItem] },
    );
  });
});
