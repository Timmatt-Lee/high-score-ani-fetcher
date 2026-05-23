import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperPipeline } from "./scraperPipeline";
import {
  type AnimeItem,
  type AnimeDetails,
  type ScrapeListResult,
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
      value: [
        { link: "http://a", title: "A" } as AnimeItem,
        { link: "http://b", title: "B" } as AnimeItem,
      ],
      errors: [],
    } as ScrapeListResult);

    listSpy.mockResolvedValueOnce({
      value: [
        { link: "http://c", title: "C" } as AnimeItem,
        { link: "http://d", title: "D" } as AnimeItem,
      ],
      errors: [],
    } as ScrapeListResult);

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

    const { value: items, errors } = await pipeline.execute();

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(detailSpy).toHaveBeenCalledTimes(3);
    expect(errors).toHaveLength(0);
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
      value: [{ link: "http://a", title: "A" } as AnimeItem],
      errors: [pageError],
    });

    detailSpy.mockResolvedValueOnce(detailError);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { value: items, errors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(errors).toContain(pageError);
    expect(errors).toContain(detailError);
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

    const { value: items, errors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    if (errors[0] instanceof ScraperHttpError) {
      expect(errors[0].html).toBe("page crash");
    }
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
      value: [{ link: "http://a", title: "A" } as AnimeItem],
      errors: [],
    });
    detailSpy.mockImplementation(() => {
      throw parseError;
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { value: items, errors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(errors).toContain(parseError);
  });

  it("aggregates returned details-level errors without throwing", async () => {
    const listSpy = vi.fn();
    const detailSpy = vi.fn();

    const error = new ScraperHttpError("http://a", "fail", 500);

    listSpy.mockResolvedValueOnce({
      value: [{ link: "http://a", title: "A" } as AnimeItem],
      errors: [],
    });

    detailSpy.mockResolvedValueOnce(error);

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { value: items, errors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(error);
  });
});
