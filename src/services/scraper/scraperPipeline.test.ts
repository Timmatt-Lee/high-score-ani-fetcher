import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperPipeline } from "./scraperPipeline";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperScanStep,
  type ScanEvent,
  ScraperService,
} from "./index";
import { type AnimeItem, type AnimeDetails } from "./types";

interface TestRunResult {
  events: ScanEvent[];
  animeItems: AnimeItem[];
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
}

const runPipeline = (pipeline: ScraperPipeline) => {
  return new Promise<TestRunResult>((resolve, reject) => {
    const events: ScanEvent[] = [];
    const animeItems: AnimeItem[] = [];
    const httpErrors: ScraperHttpError[] = [];
    const parseErrors: ScraperParseError[] = [];

    pipeline.execute().subscribe({
      next: (event: ScanEvent) => {
        events.push(event);
        if (event instanceof ScraperHttpError) {
          httpErrors.push(event);
        } else if (event instanceof ScraperParseError) {
          parseErrors.push(event);
        } else if (!(event instanceof Error)) {
          animeItems.push(event);
        }
      },
      error: reject,
      complete: () => {
        resolve({ events, animeItems, httpErrors, parseErrors });
      },
    });
  });
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
      animeItems: [
        { link: "http://a", title: "A" } as AnimeItem,
        { link: "http://b", title: "B" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    });

    listSpy.mockResolvedValueOnce({
      animeItems: [
        { link: "http://c", title: "C" } as AnimeItem,
        { link: "http://d", title: "D" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    });

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
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const { animeItems, httpErrors, parseErrors } = await runPipeline(pipeline);

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(animeItems).toHaveLength(3);

    const sortedItems = [...animeItems].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    expect(sortedItems[0].description).toBe("Desc A");
  });

  it("aggregates page-level and detail-level errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const pageError = new ScraperHttpError(
      1,
      ScraperScanStep.GET_TOTAL_PAGES,
      "http://page1",
      "fail",
      404,
      undefined,
    );
    const detailError = new ScraperHttpError(
      1,
      ScraperScanStep.GET_TOTAL_PAGES,
      "http://a",
      "fail",
      500,
      undefined,
    );

    listSpy.mockResolvedValueOnce({
      animeItems: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [pageError],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(detailError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const { animeItems, httpErrors, parseErrors } = await runPipeline(pipeline);
    expect(animeItems).toHaveLength(0);
    expect(httpErrors).toContain(pageError);
    expect(httpErrors).toContain(detailError);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates returned details-level errors without throwing", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const error = new ScraperHttpError(
      1,
      ScraperScanStep.GET_TOTAL_PAGES,
      "http://a",
      "fail",
      500,
      undefined,
    );

    listSpy.mockResolvedValueOnce({
      animeItems: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(error);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const { animeItems, httpErrors, parseErrors } = await runPipeline(pipeline);
    expect(animeItems).toHaveLength(0);
    expect(httpErrors).toContain(error);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates returned details-level parse errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const parseError = new ScraperParseError(
      1,
      ScraperScanStep.PARSE_ANIME_DETAIL,
      "http://a",
      "html",
    );

    listSpy.mockResolvedValueOnce({
      animeItems: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(parseError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const { animeItems, httpErrors, parseErrors } = await runPipeline(pipeline);
    expect(animeItems).toHaveLength(0);
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
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
    } as unknown as ScraperService);

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
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
    } as unknown as ScraperService);

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

  it("handles onlyPages option inputs to limit scanned pages", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    listSpy.mockResolvedValueOnce({
      animeItems: [
        { link: "http://newPageItem", title: "New Page Item" } as AnimeItem,
      ],
      httpErrors: [],
      parseErrors: [],
    });

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
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
      } as unknown as ScraperService,
      {
        onlyPages: [3],
      },
    );

    const { animeItems } = await runPipeline(pipeline);
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(listSpy).toHaveBeenCalledWith(3); // only page 3 retried
    expect(detailSpy).toHaveBeenCalledTimes(1); // newPageItem
    expect(detailSpy).toHaveBeenCalledWith(
      "http://newPageItem",
      3,
      "New Page Item",
    );
    expect(animeItems).toHaveLength(1);
  });

  it("emits error when fetchPage throws unexpected error", async () => {
    const listSpy = vi.fn().mockRejectedValue(new Error("fetch page crashed"));
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: vi.fn(),
    } as unknown as ScraperService);

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe("fetch page crashed");
          resolve();
        },
        complete: () => {
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("emits error when fetchDetail throws unexpected error", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      animeItems: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi
      .fn()
      .mockRejectedValue(new Error("fetch detail crashed"));
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err.message).toBe("fetch detail crashed");
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
      scrapeAnimesOnPage: vi.fn(),
      scrapeAnimeDetails: vi.fn(),
    } as unknown as ScraperService);
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
      scrapeAnimesOnPage: vi.fn(),
      scrapeAnimeDetails: vi.fn(),
    } as unknown as ScraperService);
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

  it("emits string error when fetchDetail throws unexpected string error", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      animeItems: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    const detailSpy = vi.fn().mockRejectedValue("detail string crash");
    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.execute().subscribe({
        next: () => {},
        error: (err) => {
          try {
            expect(err).toBeInstanceOf(Error);
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

  it("supports undefined page parameter in fetchDetail", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn().mockResolvedValue({
      score: 9.5,
      ratingCount: 10,
      description: "Fallback page",
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, {
      getTotalPages: vi.fn(),
      scrapeAnimesOnPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    } as unknown as ScraperService);

    await pipeline["fetchDetail"]({
      link: "http://a",
      title: "A",
    } as AnimeItem);
    expect(detailSpy).toHaveBeenCalledWith("http://a", 1, "A");
  });
});
