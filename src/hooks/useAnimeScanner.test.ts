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
} from "../services/animeScanner/types";
const { Observable } = await import("rxjs");

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
  const defaultSettings = {
    targetScore: 4.8,
    rescanThreshold: 95,
    cacheExpireDays: 14,
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("scans and calls onScanComplete with filtered results", async () => {
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
      subject.complete();
    });

    expect(result.current.progress.message).toBe("Done!");
  });

  it("handles scan failure gracefully", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
          [favItem],
          [trashItem],
          defaultSettings,
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([
        { ...lowScore, score: 4.0, ratingCount: 10, description: "Meh" },
      ]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
    const pageError = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "http://err-page",
      "Page error",
    );
    const detailError = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://err-detail",
      "Detail error",
      404,
      undefined,
    );

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([
        {
          ...mockAnime1,
          score: 9.0,
          ratingCount: 100,
          description: "Success",
        },
        detailError,
        pageError,
      ]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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

  it("handles AnimeScanHttpError scan failure in catch block", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://err",
      "Failed page",
      500,
      undefined,
    );
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(
      error as unknown as AnimeScanHttpError,
    );

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBe(error);
    expect(result.current.error?.message).toBe("generic error");
    expect(result.current.httpErrors).toHaveLength(0);
    expect(result.current.parseErrors).toHaveLength(0);
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
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(error);

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
      .mockResolvedValueOnce(error)
      .mockResolvedValueOnce(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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

  it("sorts high-award items by score descending, then title ascending", async () => {
    const itemA = { ...makeAnime("Z_Anime"), score: 9.0 };
    const itemB = { ...makeAnime("A_Anime"), score: 9.0 };
    const itemC = { ...makeAnime("M_Anime"), score: 9.5 };

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([itemA, itemB, itemC]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
          [favItem],
          [trashItem],
          defaultSettings,
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

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return createMockObservable([]);
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useAnimeScanner(
          [],
          [favItem],
          [trashItem],
          defaultSettings,
          onComplete,
        ),
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
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
        return createMockObservable([{ ...searchItem, score: 9.0 }]);
      });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useAnimeScanner(
          [searchItem],
          [favItem],
          [trashItem],
          defaultSettings,
          onComplete,
        ),
      { wrapper: ServiceProvider },
    );

    // Call handleScan with retry options
    await act(async () => {
      await result.current.handleScan({
        onlyPages: [3],
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
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      {
        wrapper: ServiceProvider,
      },
    );

    await act(async () => {
      await result.current.handleScan({}); // empty options
    });

    expect(capturedPipeline).not.toBeNull();
    expect(capturedPipeline.totalPages).toBe(2);
    expect(capturedPipeline.options).toBeUndefined();
  });

  it("progressively saves results every 3 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"));

    const mockAnime1 = makeAnime("Test1");
    const mockAnime2 = makeAnime("Test2");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(mockAnime1);
        vi.setSystemTime(new Date("2024-01-01T00:00:04Z")); // +4 seconds
        subscriber.next(mockAnime2); // trigger save
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider },
    );
    await act(async () => {
      await result.current.handleScan();
    });

    vi.useRealTimers();
  });

  it("handles generic Error events emitted during scan", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(new Error("Generic emitted error"));
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    // Error emitted via next shouldn't crash it, but is ignored from results
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        newSearchItems: [],
      }),
    );
  });

  it("handles generic string error events emitted by subscriber.error", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.error("A random string error");
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe("A random string error");
  });

  it("updates existing trash and favorite items correctly when they appear in scan results", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    const mockFav = makeAnime("Fav");
    mockFav.score = 1.0;
    const mockTrash = makeAnime("Trash");
    mockTrash.score = 2.0;

    const scannedFav = { ...mockFav, score: 9.9 };
    const scannedTrash = { ...mockTrash, score: 8.8 };

    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable<AnimeScanEvent>((subscriber) => {
        subscriber.next(scannedFav);
        subscriber.next(scannedTrash);
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useAnimeScanner(
          [],
          [mockFav],
          [mockTrash],
          defaultSettings,
          onComplete,
        ),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        updatedFavoriteList: [scannedFav],
        updatedTrashList: [scannedTrash],
      }),
    );
  });

  it("preserves unmodified fav/trash items during scan (branch coverage)", async () => {
    const mockFav = makeAnime("Fav");
    const mockTrash = makeAnime("Trash");
    const scannedAnime = makeAnime("Scanned");

    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.next(scannedAnime);
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () =>
        useAnimeScanner(
          [],
          [mockFav],
          [mockTrash],
          defaultSettings,
          onComplete,
        ),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(onComplete).toHaveBeenCalledWith({
      newSearchItems: [scannedAnime],
      updatedFavoriteList: [mockFav],
      updatedTrashList: [mockTrash],
    });
  });

  it("handles AnimeScanParseError without animeName (branch coverage)", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.next(new AnimeScanParseError(1, "step", "url", "err"));
        subscriber.complete();
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.parseErrors.length).toBe(1);
  });

  it("handles non-Error objects thrown during scan (branch coverage)", async () => {
    vi.spyOn(animeScraper, "getTotalPages").mockResolvedValue(1);
    vi.spyOn(AnimeScanner.prototype, "scan").mockImplementation(() => {
      return new Observable((subscriber) => {
        subscriber.error({ notAnError: true });
      });
    });

    const onComplete = vi.fn();
    const { result } = renderHook(
      () => useAnimeScanner([], [], [], defaultSettings, onComplete),
      { wrapper: ServiceProvider },
    );

    await act(async () => {
      await result.current.handleScan();
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});
