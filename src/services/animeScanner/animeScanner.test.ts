/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnimeScanner } from "./animeScanner";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "./index";
import {
  type AnimeScanEvent,
  type AnimeItem,
  type AnimeDetails,
  AnimeScanPageEvent,
} from "./types";
import { AnimeScraper } from "./animeScraper";

interface TestRunResult {
  events: AnimeScanEvent[];
  animeItems: AnimeItem[];
}

const runPipeline = (pipeline: AnimeScanner) => {
  return new Promise<TestRunResult>((resolve, reject) => {
    const events: AnimeScanEvent[] = [];
    const animeItems: AnimeItem[] = [];

    pipeline.scan().subscribe({
      next: (event: AnimeScanEvent) => {
        events.push(event);
        if (event instanceof AnimeScanPageEvent) {
          // ignore
        } else if (!(event instanceof Error)) {
          animeItems.push(event);
        }
      },
      error: reject,
      complete: () => {
        resolve({ events, animeItems });
      },
    });
  });
};

describe("AnimeScanner", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("scrapes page items, filters them, fetches details sequentially and returns results", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    // Mock stage 1: List pages
    listSpy.mockResolvedValueOnce([
      { link: "http://a", title: "A" } as AnimeItem,
      { link: "http://b", title: "B" } as AnimeItem,
    ]);

    listSpy.mockResolvedValueOnce([
      { link: "http://c", title: "C" } as AnimeItem,
      { link: "http://d", title: "D" } as AnimeItem,
    ]);

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

    const pipeline = new AnimeScanner(
      2,
      filterItem,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const { animeItems } = await runPipeline(pipeline);

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(animeItems).toHaveLength(3);

    const sortedItems = [...animeItems].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    expect(sortedItems[0].description).toBe("Desc A");
  });

  it("stops and propagates page-level HTTP errors", async () => {
    const listSpy = vi.fn();
    const pageError = new AnimeScanHttpError(
      1,
      AnimeScanStep.SCRAPE_LIST_PAGE,
      "http://page1",
      "fail",
      404,
      undefined,
    );

    listSpy.mockRejectedValueOnce(pageError);

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: vi.fn(),
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    await expect(runPipeline(pipeline)).rejects.toThrow(pageError);
  });

  it("stops and propagates page-level Parse errors", async () => {
    const listSpy = vi.fn();
    const pageParseError = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "http://page1",
      "fail",
    );

    listSpy.mockRejectedValueOnce(pageParseError);

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: vi.fn(),
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    await expect(runPipeline(pipeline)).rejects.toThrow(pageParseError);
  });

  it("stops and propagates details-level HTTP errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();
    const detailError = new AnimeScanHttpError(
      1,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      "http://a",
      "fail",
      500,
      undefined,
    );

    listSpy.mockResolvedValueOnce([
      { link: "http://a", title: "A" } as AnimeItem,
    ]);
    detailSpy.mockRejectedValueOnce(detailError);

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    await expect(runPipeline(pipeline)).rejects.toThrow(detailError);
  });

  it("emits error event when the pipeline catches an error", async () => {
    const listSpy = vi
      .fn()
      .mockRejectedValue(new Error("unexpected queue error"));

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: vi.fn(),
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.scan().subscribe({
        next: () => {},
        error: (err: any) => {
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

  it("emits non-Error string catches inside pipeline", async () => {
    const listSpy = vi.fn().mockRejectedValue("unexpected string queue error");

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: vi.fn(),
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.scan().subscribe({
        next: () => {},
        error: (err: any) => {
          expect(err).toBe("unexpected string queue error");
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

    listSpy.mockResolvedValueOnce([
      { link: "http://newPageItem", title: "New Page Item" } as AnimeItem,
    ]);

    detailSpy.mockImplementation(async (link: string) => {
      return {
        score: 9.5,
        ratingCount: 200,
        description: `Retried ${link}`,
      };
    });

    const pipeline = new AnimeScanner(
      5, // total pages 5, but we only scan 1 because of onlyPages option
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      {
        onlyPages: [3],
        requestDelayMs: 0,
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
    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: vi.fn(),
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.scan().subscribe({
        next: () => {},
        error: (err: any) => {
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
    const listSpy = vi
      .fn()
      .mockResolvedValue([{ link: "http://a", title: "A" } as AnimeItem]);
    const detailSpy = vi
      .fn()
      .mockRejectedValue(new Error("fetch detail crashed"));
    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.scan().subscribe({
        next: () => {},
        error: (err: any) => {
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

  it("emits string error when fetchDetail throws unexpected string error", async () => {
    const listSpy = vi
      .fn()
      .mockResolvedValue([{ link: "http://a", title: "A" } as AnimeItem]);
    const detailSpy = vi.fn().mockRejectedValue("detail string crash");
    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    const runPromise = new Promise<void>((resolve, reject) => {
      pipeline.scan().subscribe({
        next: () => {},
        error: (err: any) => {
          try {
            expect(err).toBe("detail string crash");
            resolve();
          } catch (e) {
            reject(e);
          }
        },
        complete: () => {
          expect(true).toBe(false); // Should not reach complete callback
          reject(new Error("Should not complete"));
        },
      });
    });
    await runPromise;
  });

  it("supports page parameter in fetchDetail", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn().mockResolvedValue({
      score: 9.5,
      ratingCount: 10,
      description: "Fallback page",
    });

    const pipeline = new AnimeScanner(
      1,
      () => true,
      {
        getTotalPages: vi.fn(),
        scrapeAnimesOnPage: listSpy,
        scrapeAnimeDetails: detailSpy,
        delay: vi.fn().mockResolvedValue(undefined),
      } as unknown as AnimeScraper,
      { requestDelayMs: 0 },
    );

    await pipeline["fetchDetail"](
      {
        link: "http://a",
        title: "A",
      } as AnimeItem,
      1,
    );
    expect(detailSpy).toHaveBeenCalledWith("http://a", 1, "A");
  });
});
