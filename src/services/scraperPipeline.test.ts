import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperPipeline } from "./scraperPipeline";
import {
  type AnimeItem,
  type AnimeDetails,
  type ScraperResult,
} from "../types/anime";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperErrorSource,
} from "../errors";

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

    const onProgress = vi.fn();
    const filterItem = (item: AnimeItem) => item.title !== "B";

    const pipeline = new ScraperPipeline(2, 2, 2, filterItem, onProgress, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(items).toHaveLength(3);

    const sortedItems = [...items].sort((a, b) =>
      a.title.localeCompare(b.title),
    );
    expect(sortedItems[0].description).toBe("Desc A");
    expect(onProgress).toHaveBeenCalled();
  });

  it("aggregates page-level and detail-level errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const pageError = new ScraperHttpError("http://page1", "fail", 404);
    const detailError = new ScraperHttpError("http://a", "fail", 500);

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [pageError],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(detailError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(httpErrors).toContain(pageError);
    expect(httpErrors).toContain(detailError);
    expect(parseErrors).toHaveLength(0);
  });

  it("wraps non-Error page failures in ScraperHttpError", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    listSpy.mockImplementation(() => {
      throw "page crash";
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    if (httpErrors[0] instanceof ScraperHttpError) {
      expect(httpErrors[0].html).toBe("page crash");
    }
    expect(parseErrors).toHaveLength(0);
  });

  it("wraps generic Error page failures in ScraperHttpError with message", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    listSpy.mockImplementation(() => {
      throw new Error("unexpected error object");
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    if (httpErrors[0] instanceof ScraperHttpError) {
      expect(httpErrors[0].html).toBe("unexpected error object");
    }
    expect(parseErrors).toHaveLength(0);
  });

  it("covers remaining error branches", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const parseError = new ScraperParseError(
      ScraperErrorSource.SCORE,
      "http://a",
      "html",
    );
    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });
    detailSpy.mockImplementation(() => {
      throw parseError;
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(parseErrors).toContain(parseError);
    expect(httpErrors).toHaveLength(0);
  });

  it("aggregates returned details-level errors without throwing", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const error = new ScraperHttpError("http://a", "fail", 500);

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(error);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBe(error);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates returned details-level parse errors", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const parseError = new ScraperParseError(
      ScraperErrorSource.SCORE,
      "http://a",
      "html",
    );

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });

    detailSpy.mockResolvedValueOnce(parseError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBe(parseError);
    expect(httpErrors).toHaveLength(0);
  });

  it("handles caught ScraperHttpError in catch block", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const httpError = new ScraperHttpError("http://a", "fail", 500);

    listSpy.mockResolvedValueOnce({
      items: [{ link: "http://a", title: "A" } as AnimeItem],
      httpErrors: [],
      parseErrors: [],
    });

    detailSpy.mockImplementation(() => {
      throw httpError;
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBe(httpError);
    expect(parseErrors).toHaveLength(0);
  });
});
