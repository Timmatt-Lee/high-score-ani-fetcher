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
      watchCount: 100,
      episodeCount: 12,
      uploadDate: new Date(),
      score: 0,
      ratingCount: 0,
      description: "",
    }) as AnimeItem;

  it("scrapes page items, filters them, fetches details concurrently and returns results", async () => {
    const listSpy = vi.fn().mockImplementation(async (page) => {
      if (page === 1) {
        return {
          items: [makeItem("A", "http://a"), makeItem("B", "http://b")],
          errors: [],
        };
      }
      return {
        items: [makeItem("C", "http://c"), makeItem("D", "http://d")],
        errors: [],
      };
    });

    const detailSpy = vi.fn().mockImplementation(async (link) => {
      const char = link.replace("http://", "");
      return {
        isSuccess: true,
        items: {
          score: 9.0,
          ratingCount: 100,
          description: `Desc ${char.toUpperCase()}`,
        },
        error: undefined,
      };
    });

    const onProgress = vi.fn();
    const filterItem = (item: AnimeItem) => item.title !== "B";

    const pipeline = new ScraperPipeline(2, 2, 2, filterItem, onProgress, {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items: items, errors } = await pipeline.execute();
    const httpErrors = errors.filter(
      (e): e is ScraperHttpError => e instanceof ScraperHttpError,
    );
    const parseErrors = errors.filter(
      (e): e is ScraperParseError => e instanceof ScraperParseError,
    );

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
          errors: [
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
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items: items, errors } = await pipeline.execute();
    const httpErrors = errors.filter(
      (e): e is ScraperHttpError => e instanceof ScraperHttpError,
    );
    const parseErrors = errors.filter(
      (e): e is ScraperParseError => e instanceof ScraperParseError,
    );

    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(2);
    expect(httpErrors).toHaveLength(2);

    const parseErrorTitle = parseErrors.find(
      (e) => e.source === ScraperErrorSource.TITLE,
    );
    const parseErrorScore = parseErrors.find(
      (e) => e.source === ScraperErrorSource.SCORE,
    );
    expect(parseErrorTitle).toBeDefined();
    expect(parseErrorScore).toBeDefined();

    const httpError404 = httpErrors.find((e) => e.status === 404);
    const httpError500 = httpErrors.find((e) => e.status === 500);
    expect(httpError404).toBeDefined();
    expect(httpError500).toBeDefined();
  });

  it("wraps non-Error page and detail failures", async () => {
    const listSpy = vi.fn().mockRejectedValue("String Page Failure");
    const detailSpy = vi.fn();

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items: items, errors } = await pipeline.execute();
    const httpErrors = errors.filter(
      (e): e is ScraperHttpError => e instanceof ScraperHttpError,
    );
    const parseErrors = errors.filter(
      (e): e is ScraperParseError => e instanceof ScraperParseError,
    );

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
          errors: [],
        };
      } else {
        return {
          items: [makeItem("C", "http://c")],
          errors: [],
        };
      }
    });

    const detailSpy = vi.fn().mockImplementation(async (link) => {
      if (link === "http://a" || link === "http://b") {
        return {
          isSuccess: true,
          items: { score: 9.0, ratingCount: 100, description: "OK" },
          error: undefined,
        };
      }
      throw "Raw Detail Error String";
    });

    const pipeline = new ScraperPipeline(3, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items: items, errors } = await pipeline.execute();
    const httpErrors = errors.filter(
      (e): e is ScraperHttpError => e instanceof ScraperHttpError,
    );
    const parseErrors = errors.filter(
      (e): e is ScraperParseError => e instanceof ScraperParseError,
    );

    expect(items).toHaveLength(2);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors).toHaveLength(2);

    const normalPageError = httpErrors.find(
      (e) => e.html === "Normal Page Error",
    );
    const rawDetailError = httpErrors.find(
      (e) => e.html === "Raw Detail Error String",
    );
    expect(normalPageError).toBeDefined();
    expect(rawDetailError).toBeDefined();
  });

  it("aggregates returned details-level errors without throwing", async () => {
    const listSpy = vi.fn().mockResolvedValue({
      items: [makeItem("A", "http://a")],
      errors: [],
    });

    const detailSpy = vi.fn().mockResolvedValue({
      isSuccess: false,
      items: undefined,
      error: new ScraperHttpError("http://a", "http err returned", 500),
    });

    const pipeline = new ScraperPipeline(1, 1, 1, () => true, vi.fn(), {
      getTotalPages: vi.fn(),
      scrapeListPage: listSpy,
      scrapeAnimeDetails: detailSpy,
    });

    const { items: items, errors } = await pipeline.execute();
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).html).toBe("http err returned");
  });
});
