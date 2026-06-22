import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAnimeScanner } from "./useAnimeScanner";
import { animeScraper } from "../services/animeScanner/animeScraper";
import { ServiceProvider } from "../contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
  AnimeScanner,
} from "../services/animeScanner";
import {
  type AnimeScanEvent,
  type AnimeItem,
  AnimeScanPageEvent,
} from "../services/animeScanner/types";
import { Observable, Subject } from "rxjs";

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
  events: AnimeScanEvent[] = [],
): Observable<AnimeScanEvent> {
  return new Observable<AnimeScanEvent>((subscriber) => {
    for (const event of events) {
      subscriber.next(event);
    }
    subscriber.complete();
  });
}

describe("useAnimeScanner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("scans and calls onScanUpdate with filtered results", async () => {
    const mockAnime = makeAnime("Test");
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(
      function (this: { filterItem: (item: AnimeItem) => boolean }) {
        if (this.filterItem(mockAnime)) {
          return createMockObservable([
            {
              ...mockAnime,
              score: 9.0,
              ratingCount: 100,
              description: "x",
            },
          ]);
        }
        return createMockObservable([]);
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const { Subject } = await import("rxjs");
    const subject = new Subject<AnimeScanEvent>();
    vi.spyOn(AnimeScanner.prototype, "scan").mockReturnValue(subject);

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
      subject.next(mockAnime);
    });
    expect(result.current.progress.message).toContain("ProgressTest");

    await act(async () => {
      subject.next(new AnimeScanPageEvent(2, 5));
    });
    expect(result.current.progress.message).toBe(
      "Fetching list pages (2/5)...",
    );

    await act(async () => {
      subject.complete();
    });

    expect(result.current.progress.message).toBe("Done!");
  });

  it("handles scan failure gracefully", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue(
      new AnimeScanHttpError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        "",
        "network down",
        500,
        undefined,
      ),
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
    const trashItem2 = makeAnime("InTrash2");
    trashItem2.link = "http://InTrash2";
    const favItem2 = makeAnime("InFav2");
    favItem2.link = "http://InFav2";

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(
      function (this: { filterItem: (item: AnimeItem) => boolean }) {
        const items = [trashItem, favItem].filter(this.filterItem);
        return createMockObservable(
          items.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "UpdatedDesc",
          })),
        );
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
      newSearchItems: [],
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

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(
      function (this: { filterItem: (item: AnimeItem) => boolean }) {
        const items = [shortShow, ovaShow, naShow].filter(this.filterItem);
        return createMockObservable(
          items.map((item) => ({
            ...item,
            score: 9.0,
            ratingCount: 100,
            description: "x",
          })),
        );
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

  it("saves new items even with score below 4.8 to ensure caching works", async () => {
    const lowScore = makeAnime("LowScore");
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([
        { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
      ]);
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
        { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
      ],
      updatedFavoriteList: [],
      updatedTrashList: [],
    });
  });

  it("stops and sets error when pipeline emits error", async () => {
    const mockAnime1 = makeAnime("SuccessAnime");
    const detailError = new AnimeScanHttpError(
      1,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      "http://err-detail",
      "Detail error",
      404,
      undefined,
    );

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.next({
          ...mockAnime1,
          score: 9.0,
          ratingCount: 100,
          description: "Success",
        });
        subscriber.error(detailError);
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

    expect(result.current.error).toBe(detailError);
  });

  it("handles AnimeScanHttpError scan failure in catch block", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://err",
      "Failed page",
      500,
      undefined,
    );
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue(error);

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

  it("handles AnimeScanParseError scan failure in catch block", async () => {
    const error = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "http://err",
      "Failed page",
    );
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue(error);

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

  it("sets error to the generic Error when getTotalPages fails with unknown error", async () => {
    const error = new Error("generic error");
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue(
      error as unknown as AnimeScanHttpError,
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
    expect(result.current.error?.message).toBe("generic error");
  });

  it("clears error when clearError is called", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://err",
      "Failed",
      500,
      undefined,
    );
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue(error);

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
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://err",
      "Failed",
      500,
      undefined,
    );
    vi.spyOn(animeScraper, "getTotalPages")
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([]);
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(0);
    const { Subject } = await import("rxjs");
    const subject = new Subject<AnimeScanEvent>();
    vi.spyOn(AnimeScanner.prototype, "scan").mockReturnValue(subject);

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
      subject.next(mockAnime);
    });
    expect(result.current.progress.percent).toBe(0);

    await act(async () => {
      subject.complete();
    });
  });

  it("returns scanned items in insertion order", async () => {
    const itemA = { ...makeAnime("Z_Anime"), score: 9.0 };
    const itemB = { ...makeAnime("A_Anime"), score: 9.0 };
    const itemC = { ...makeAnime("M_Anime"), score: 9.5 };

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([itemA, itemB, itemC]);
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
    const completedResult =
      onComplete.mock.calls[onComplete.mock.calls.length - 1][0];
    expect(completedResult.newSearchItems[0].title).toBe("Z_Anime");
    expect(completedResult.newSearchItems[1].title).toBe("A_Anime");
    expect(completedResult.newSearchItems[2].title).toBe("M_Anime");
  });

  it("preserves fav/trash items not found in scan results", async () => {
    const trashItem = makeAnime("NotFoundTrash");
    const favItem = makeAnime("NotFoundFav");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([]);
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

  it("handles pipeline errors during scanning by setting error directly", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.error(new Error("pipeline crash"));
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

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("pipeline crash");
    expect(result.current.isScanning).toBe(false);
  });

  it("ignores generic Error instances in next callback", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        // Send a generic Error which is not AnimeScanHttpError or AnimeScanParseError
        subscriber.next(
          new Error("generic ignore error") as unknown as AnimeItem,
        );
        subscriber.complete();
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

    expect(result.current.error).toBeNull();
    expect(result.current.isScanning).toBe(false);
  });

  it("saves each scanned item immediately during scan", async () => {
    const items: AnimeItem[] = Array.from({ length: 3 }, (_, i) => ({
      ...makeAnime(`Anime${i}`),
      score: 9.0,
    }));

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);

    const { Subject } = await import("rxjs");
    const subject = new Subject<AnimeScanEvent>();
    vi.spyOn(AnimeScanner.prototype, "scan").mockReturnValue(subject);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      result.current.handleScan();
    });

    // Send first item
    await act(async () => {
      subject.next(items[0]);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // Send second item
    await act(async () => {
      subject.next(items[1]);
    });
    expect(onComplete).toHaveBeenCalledTimes(2);

    // Complete the subscription
    await act(async () => {
      subject.complete();
    });
    expect(onComplete).toHaveBeenCalledTimes(3);
  });

  it("handles string pipeline errors during scanning by wrapping in Error", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.error("pipeline string crash");
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

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("pipeline string crash");
    expect(result.current.isScanning).toBe(false);
  });

  it("handles fallback to original items in complete callback when updated item is missing in map", async () => {
    const favItem = makeAnime("FavItem");
    const trashItem = makeAnime("TrashItem");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([]); // Complete scan with no items found, triggering the ?? fallback in map
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [favItem], [trashItem], onComplete),
      {
        wrapper: ServiceProvider,
      },
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

  it("handles retry scans by pre-populating merged items map and bypassing total page fetch", async () => {
    const searchItem = makeAnime("SearchItem");
    const favItem = makeAnime("FavItem");
    const trashItem = makeAnime("TrashItem");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedPipeline: any = null;
    vi.spyOn(AnimeScanner.prototype, "scan")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(function (this: any) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        capturedPipeline = this;
        return createMockObservable([
          new AnimeScanPageEvent(1, 1),
          { ...searchItem, score: 9.0 },
        ]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([searchItem], [favItem], [trashItem], onComplete),
      { wrapper: ServiceProvider },
    );

    // Call handleScan with retry options
    await act(async () => {
      await result.current.handleScan({
        onlyPages: [3],
        requestDelayMs: 800,
      });
    });

    // Check that getTotalPages was not called
    const pagesSpy = vi.spyOn(animeScraper, "getTotalPages");
    expect(pagesSpy).not.toHaveBeenCalled();

    // Check that AnimeScanner was instantiated with option args
    expect(capturedPipeline).not.toBeNull();
    expect(capturedPipeline.totalPages).toBe(0);
    expect(capturedPipeline.options).toEqual({
      onlyPages: [3],
      requestDelayMs: 800,
    });

    expect(onComplete).toHaveBeenCalled();
  });

  it("handles empty options object as non-retry conditions", async () => {
    // 1. Empty options should be treated as non-retry
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedPipeline: any = null;
    vi.spyOn(AnimeScanner.prototype, "scan")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(function (this: any) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        capturedPipeline = this;
        return createMockObservable([]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan({ requestDelayMs: 800 }); // empty options
    });

    expect(capturedPipeline).not.toBeNull();
    expect(capturedPipeline.totalPages).toBe(2);
    expect(capturedPipeline.options).toEqual({ requestDelayMs: 800 });
  });

  it("skips scan for cached items with low score", async () => {
    const lowScoreItem = makeAnime("LowScoreItem");
    lowScoreItem.score = 4.0; // below threshold (4.8 * 95% = 4.56)

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const scanSpy = vi
      .spyOn(AnimeScanner.prototype, "scan")
      .mockImplementation(function (this: {
        filterItem: (item: AnimeItem) => boolean;
      }) {
        const isKept = this.filterItem(lowScoreItem);
        expect(isKept).toBe(false);
        return createMockObservable([]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([lowScoreItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(scanSpy).toHaveBeenCalled();
  });

  it("does not skip scan for cached items with score 0 or above threshold", async () => {
    const zeroScoreItem = makeAnime("ZeroScoreItem");
    zeroScoreItem.score = 0;

    const highScoreItem = makeAnime("HighScoreItem");
    highScoreItem.score = 4.9;

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const scanSpy = vi
      .spyOn(AnimeScanner.prototype, "scan")
      .mockImplementation(function (this: {
        filterItem: (item: AnimeItem) => boolean;
      }) {
        expect(this.filterItem(zeroScoreItem)).toBe(true);
        expect(this.filterItem(highScoreItem)).toBe(true);
        return createMockObservable([]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([zeroScoreItem, highScoreItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(scanSpy).toHaveBeenCalled();
  });

  it("skips scan for cached items with fresh scannedAt date", async () => {
    const freshItem = makeAnime("FreshItem");
    freshItem.score = 4.9; // Above threshold
    freshItem.scannedAt = new Date(); // Scanned just now, very fresh

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const scanSpy = vi
      .spyOn(AnimeScanner.prototype, "scan")
      .mockImplementation(function (this: {
        filterItem: (item: AnimeItem) => boolean;
      }) {
        expect(this.filterItem(freshItem)).toBe(false);
        return createMockObservable([]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([freshItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(scanSpy).toHaveBeenCalled();
  });

  it("does not skip scan for cached items with expired scannedAt date", async () => {
    const expiredItem = makeAnime("ExpiredItem");
    expiredItem.score = 4.9; // Above threshold
    // 15 days ago (default cache duration is 14 days)
    expiredItem.scannedAt = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const scanSpy = vi
      .spyOn(AnimeScanner.prototype, "scan")
      .mockImplementation(function (this: {
        filterItem: (item: AnimeItem) => boolean;
      }) {
        expect(this.filterItem(expiredItem)).toBe(true);
        return createMockObservable([]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([expiredItem], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(scanSpy).toHaveBeenCalled();
  });

  it("cancels scanning when cancelScan is called", async () => {
    const subject = new Subject<AnimeScanEvent>();
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockReturnValue(subject);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      result.current.handleScan();
    });

    expect(result.current.isScanning).toBe(true);

    act(() => {
      result.current.cancelScan();
    });

    expect(result.current.isScanning).toBe(false);
  });

  it("handles empty onlyPages array in options as non-retry", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const scanSpy = vi
      .spyOn(AnimeScanner.prototype, "scan")
      .mockReturnValue(createMockObservable([]));
    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan({ onlyPages: [], requestDelayMs: 0 });
    });

    expect(scanSpy).toHaveBeenCalled();
  });

  it("handles non-Error objects thrown by getTotalPages", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockRejectedValue("string error");
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

  it("handles cancelScan when not scanning", () => {
    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], onComplete),
      { wrapper: ServiceProvider },
    );
    act(() => {
      result.current.cancelScan();
    });
    expect(result.current.isScanning).toBe(false);
  });
});
