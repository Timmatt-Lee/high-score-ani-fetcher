import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperPipeline } from "./scraperPipeline";
import {
  type AnimeItem,
  type AnimeDetails,
  type ScraperResult,
} from "../../types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
  ScraperUnknownError,
  type ScanEvent,
} from "./index";

const runPipeline = (pipeline: ScraperPipeline) => {
  return new Promise<{ events: ScanEvent[]; result: ScraperResult }>(
    (resolve, reject) => {
      const events: ScanEvent[] = [];
      pipeline.execute().subscribe({
        next: (event: ScanEvent) => {
          events.push(event);
        },
        error: reject,
        complete: () => {
          const completedEvent = events.find((e) => e.type === "completed");
          if (completedEvent && completedEvent.type === "completed") {
            resolve({ events, result: completedEvent.result });
          } else {
            reject(new Error("No completed event found"));
          }
        },
      });
    },
  );
};

describe("ScraperPipeline", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("scrapes page items, filters them, fetches details concurrently and returns results", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    // Mock stage 1: List pages
    listSpy.mockResolvedValueOnce({
      items: [
        { link: "http://a", title: "A" } as AnimeItem,
        { link: "http://b", title: "B" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    } as ScraperResult);

    listSpy.mockResolvedValueOnce({
      items: [
        { link: "http://c", title: "C" } as AnimeItem,
        { link: "http://d", title: "D" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    } as ScraperResult);

    // Mock stage 2: Details
    detailSpy.mockImplementation(async (link: string) => {
      const char = link.split("/").pop();
      return {
        score: 9.0,
        ratingCount: 100,
        description: `Desc ${char?.toUpperCase()}`,
      } as AnimeDetails;
    });

    const filterItem = (item: AnimeItem) => item.title !== "B";

    const pipeline = new ScraperPipeline(2, 2, 2, filterItem, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const { events, result } = await runPipeline(pipeline);
    const { items, httpErrors, parseErrors } = result;

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(items).toHaveLength(3);

    const sortedItems = [...items].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    expect(sortedItems[0].description).toBe("Desc A");
    expect(events.some((e) => e.type === "page_completed")).toBe(true);
  });

  it("aggregates page-level and detail-level errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const pageError = new ScraperHttpError(
      1,
      ScraperScanStep.PAGINATION,
      "http://page1",
      "fail",
      404,
      undefined,
    );
    const detailError = new ScraperHttpError(
      1,
      ScraperScanStep.PAGINATION,
      "http://a",
      "fail",
      500,
      undefined,
    );

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [pageError],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(detailError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const { events, result } = await runPipeline(pipeline);
    const { items, httpErrors, parseErrors } = result;
    expect(events.some((e) => e.type === "page_completed")).toBe(true);
    expect(items).toHaveLength(0);
    expect(httpErrors).toContain(pageError);
    expect(httpErrors).toContain(detailError);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates returned details-level errors without throwing", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const error = new ScraperHttpError(
      1,
      ScraperScanStep.PAGINATION,
      "http://a",
      "fail",
      500,
      undefined,
    );

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    } as ScraperResult);

    detailSpy.mockResolvedValueOnce(error);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const { events, result } = await runPipeline(pipeline);
    const { items, httpErrors, parseErrors } = result;
    expect(events.some((e) => e.type === "page_completed")).toBe(true);
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBe(error);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates returned details-level parse errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const parseError = new ScraperParseError(
      1,
      ScraperScanStep.SCORE,
      "http://a",
      "html",
    );

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    } as ScraperResult);

    detailSpy.mockResolvedValueOnce(parseError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const { events, result } = await runPipeline(pipeline);
    const { items, httpErrors, parseErrors } = result;
    expect(events.some((e) => e.type === "page_completed")).toBe(true);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBe(parseError);
    expect(httpErrors).toHaveLength(0);
  });

  it("emits error event when the pipeline catches an error", async () => {
    const listSpy = vi
      .fn()
      .mockRejectedValue(new Error("unexpected queue error"));

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
      scanAllWithPipeline: vi.fn(),
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err.message).toBe("unexpected queue error");
          resolve();
        },
        complete: () => {
          reject(new Error("Should not complete successfully"));
        },
      });
    });

    await runPromise;
  });

  it("emits non-Error string catches as Error inside pipeline", async () => {
    const listSpy = vi.fn().mockRejectedValue("unexpected string queue error");

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
      scanAllWithPipeline: vi.fn(),
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe("unexpected string queue error");
          resolve();
        },
        complete: () => {
          reject(new Error("Should not complete successfully"));
        },
      });
    });

    await runPromise;
  });

  it("handles failedPages and failedDetails option inputs to pre-populate detailQueue and limit scanned pages", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const failedDetail = {
      link: "http://failedDetail",
      title: "Failed Detail",
    } as AnimeItem;

    listSpy.mockResolvedValueOnce({
      items: [
        { link: "http://newPageItem", title: "New Page Item" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    } as ScraperResult);

    detailSpy.mockImplementation(async (link: string) => {
      return {
        score: 9.5,
        ratingCount: 200,
        description: `Retried ${link}`,
      };
    });

    const pipeline = new ScraperPipeline(
      5, // total pages 5, but we only scan 1 because of onlyPages option
      1,
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeListPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        scanAllWithPipeline: vi.fn(),
      },
      {
        onlyPages: [3],
        onlyAnimeItems: [failedDetail],
      },
    );

    const { result } = await runPipeline(pipeline);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith(3); // only page 3 retried
    expect(detailSpy).toHaveBeenCalledTimes(2); // failedDetail + newPageItem
    expect(detailSpy).toHaveBeenCalledWith("http://failedDetail", 1);
    expect(detailSpy).toHaveBeenCalledWith("http://newPageItem", 3);
    expect(result.items).toHaveLength(2);
  });

  it("emits ScraperUnknownError when fetchPage throws unexpected error", async () => {
    const listSpy = vi.fn().mockRejectedValue(new Error("fetch page crashed"));
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
      scanAllWithPipeline: vi.fn(),
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(ScraperUnknownError);
          expect(err.message).toBe("fetch page crashed");
          expect(err.scanStep).toBe(ScraperScanStep.PAGINATION);
          expect(err.url).toBe("https://ani.gamer.com.tw/animeList.php?page=1");
          resolve();
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits ScraperUnknownError when fetchDetail throws unexpected error", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi
      .fn()
      .mockRejectedValue(new Error("fetch detail crashed"));
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(ScraperUnknownError);
          expect(err.message).toBe("fetch detail crashed");
          expect(err.scanStep).toBe(ScraperScanStep.TITLE);
          expect(err.url).toBe("http://a");
          expect(err.animeName).toBe("A");
          resolve();
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits error when queueing page task throws synchronously", async () => {
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: vi.fn(),
      scrapeAnimeDetails: vi.fn(),
      scanAllWithPipeline: vi.fn(),
    });
    vi.spyOn(pipeline["pageQueue"], "add").mockImplementation(() => {
      throw new Error("sync queue error");
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          try {
            expect(err.message).toBe("sync queue error");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits string error when queueing page task throws string synchronously", async () => {
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: vi.fn(),
      scrapeAnimeDetails: vi.fn(),
      scanAllWithPipeline: vi.fn(),
    });
    vi.spyOn(pipeline["pageQueue"], "add").mockImplementation(() => {
      throw "sync string queue error";
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          try {
            expect(err).toBeInstanceOf(Error);
            expect(err.message).toBe("sync string queue error");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits ScraperUnknownError with fallback page when fetchDetail with undefined page throws unexpected error", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      items: [],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi
      .fn()
      .mockRejectedValue(new Error("retry detail crashed"));
    const failedDetail = {
      link: "http://failedDetail",
      title: "Failed Detail",
    } as AnimeItem;

    const pipeline = new ScraperPipeline(
      1,
      1,
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeListPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        scanAllWithPipeline: vi.fn(),
      },
      {
        onlyAnimeItems: [failedDetail],
      },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          try {
            expect(err).toBeInstanceOf(ScraperUnknownError);
            expect(err.message).toBe("retry detail crashed");
            expect(err.page).toBe(1);
            expect(err.scanStep).toBe(ScraperScanStep.TITLE);
            expect(err.url).toBe("http://failedDetail");
            expect(err.animeName).toBe("Failed Detail");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits ScraperUnknownError with string error when fetchDetail throws unexpected string error", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi.fn().mockRejectedValue("detail string crash");
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
      scanAllWithPipeline: vi.fn(),
    });

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          try {
            expect(err).toBeInstanceOf(ScraperUnknownError);
            expect(err.message).toBe("detail string crash");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });
});
