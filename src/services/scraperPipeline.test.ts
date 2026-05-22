import { describe, it, expect, vi } from "vitest";
import { ScraperPipeline } from "./scraperPipeline";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
import { type AnimeItem } from "../types/anime";

describe("ScraperPipeline", () => {
  const makeItem = (title: string, link: string): AnimeItem =>
    ({
      link,
      title,
      watch_count: 100,
      episode_count: 12,
      upload_date: new Date(),
      score: 0,
      rating_count: 0,
      description: "",
    }) as AnimeItem;

  it("scrapes page items, filters them, fetches details concurrently and returns results", async () => {
    const listSpy = vi.fn().mockImplementation(async (page) => {
      if (page === 1) {
        return {
          items: [makeItem("A", "http://a"), makeItem("B", "http://b")],
          parseErrors: [],
        };
      }
      return {
        items: [makeItem("C", "http://c"), makeItem("D", "http://d")],
        parseErrors: [],
      };
    });

    const detailSpy = vi.fn().mockImplementation(async (link) => {
      const char = link.replace("http://", "");
      return {
        score: 9.0,
        rating_count: 100,
        description: `Desc ${char.toUpperCase()}`,
      };
    });

    const onProgress = vi.fn();
    const filterItem = (item: AnimeItem) => item.title !== "B";

    const pipeline = new ScraperPipeline(2, 2, 2, filterItem, onProgress, {
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
    expect(sortedItems[0].title).toBe("A");
    expect(sortedItems[1].title).toBe("C");
    expect(sortedItems[2].title).toBe("D");

    expect(sortedItems[0].description).toBe("Desc A");
    expect(sortedItems[1].description).toBe("Desc C");
    expect(sortedItems[2].description).toBe("Desc D");

    expect(onProgress).toHaveBeenCalled();
  });

  it("aggregates page-level and detail-level errors", async () => {
    const listSpy = vi.fn().mockImplementation(async (page) => {
      if (page === 1) {
        return {
          items: [makeItem("A", "http://a"), makeItem("B", "http://b")],
          parseErrors: [
            new ScraperParseError(
              ScraperErrorSource.TITLE,
              "http://a",
              "parse err",
            ),
          ],
        };
      }
      throw new ScraperHttpError("http://page2", "http err", 404);
    });

    const detailSpy = vi.fn().mockImplementation(async (link) => {
      if (link === "http://a") {
        throw new ScraperHttpError("http://a", "http err detail", 500);
      }
      throw new ScraperParseError(
        ScraperErrorSource.SCORE,
        "http://b",
        "parse err detail",
      );
    });

    const pipeline = new ScraperPipeline(2, 1, 1, () => true, vi.fn(), {
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(2);
    expect(httpErrors).toHaveLength(2);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.TITLE);
    expect(parseErrors[1]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[1].source).toBe(ScraperErrorSource.SCORE);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].status).toBe(404);
    expect(httpErrors[1]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[1].status).toBe(500);
  });

  it("wraps non-Error page and detail failures", async () => {
    const listSpy = vi.fn().mockRejectedValue("String Page Failure");
    const detailSpy = vi.fn();

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].html).toBe("String Page Failure");
  });

  it("covers remaining error branches", async () => {
    const listSpy = vi.fn().mockImplementation(async (page) => {
      if (page === 1) {
        throw new Error("Normal Page Error");
      } else if (page === 2) {
        return {
          items: [makeItem("A", "http://a"), makeItem("B", "http://b")],
          parseErrors: [],
        };
      } else {
        return {
          items: [makeItem("C", "http://c")],
          parseErrors: [],
        };
      }
    });

    const detailSpy = vi.fn().mockImplementation(async (link) => {
      if (link === "http://a" || link === "http://b") {
        return { score: 9.0, rating_count: 100, description: "OK" };
      }
      throw "Raw Detail Error String";
    });

    const pipeline = new ScraperPipeline(3, 1, 1, () => true, vi.fn(), {
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items, httpErrors, parseErrors } = await pipeline.execute();

    expect(items).toHaveLength(2);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors).toHaveLength(2);

    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].html).toBe("Normal Page Error");

    expect(httpErrors[1]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[1].html).toBe("Raw Detail Error String");
  });
});
