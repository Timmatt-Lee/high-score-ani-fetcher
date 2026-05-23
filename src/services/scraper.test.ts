import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService } from "./scraper";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
import { type AnimeItem } from "../types/anime";
import { isError } from "../types/result";

// --- Helpers ---
const makeHtml = (content: string) => `<html><body>${content}</body></html>`;

const mockFetch = (
  html: string,
  ok = true,
  status = 200,
  statusText = "OK",
) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      statusText,
      text: async () => html,
    }),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// --- getTotalPages ---
describe("scraperService.getTotalPages", () => {
  it("returns ScraperParseError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperParseError);
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.PAGINATION,
      );
    }
  });

  it("parses the last page number from links", async () => {
    mockFetch(
      makeHtml(`
      <div class="page_number">
        <a href="?page=1">1</a>
        <a href="?page=2">2</a>
        <a href="?page=5">5</a>
      </div>
    `),
    );
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(false);
    expect(result).toBe(5);
  });

  it("returns ScraperParseError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("No pagination text");
    }
  });

  it("returns ScraperParseError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("Invalid page number");
    }
  });

  it("returns ScraperHttpError when response is not ok", async () => {
    mockFetch("Error Page", false, 404, "Not Found");
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperHttpError);
      expect((result as ScraperHttpError).status).toBe(404);
      expect((result as ScraperHttpError).html).toBe("Error Page");
    }
  });

  it("handles fetch failure (network error) by returning ScraperHttpError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperHttpError);
      expect((result as ScraperHttpError).html).toBe("network");
    }
  });

  it("passes through ScraperHttpError from fetchText in getTotalPages", async () => {
    const error = new ScraperHttpError("http://x", "fail", 502);
    vi.spyOn(
      scraperService as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >,
      "fetchText",
    ).mockResolvedValue(error);

    const result = await scraperService.getTotalPages();
    expect(result).toBe(error);
  });
});

// --- scrapeListPage ---
describe("scraperService.scrapeListPage", () => {
  it("parses basic card info correctly", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>25,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].title).toBe("Test Anime");
    expect(result.value[0].episodeCount).toBe(12);
    expect(result.value[0].watchCount).toBe(25000);
    expect(result.value[0].uploadDate.getFullYear()).toBe(2024);
  });

  it("collects ScraperParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.value).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    expect((result.errors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.TITLE,
    );
  });

  it("collects ScraperParseError when title textContent is empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name">  </p></a>',
      ),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    if (isError(result.errors[0])) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when title textContent is exactly empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>',
      ),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    if (isError(result.errors[0])) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).message).toContain(
      "Missing href",
    );
  });

  it("collects ScraperParseError when watch count element is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.WATCH_COUNT,
    );
  });

  it("collects ScraperParseError when watch count parsing fails", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>Invalid</p>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.WATCH_COUNT,
    );
  });

  it("collects ScraperParseError when detail block is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.EPISODE_COUNT,
    );
  });

  it("collects ScraperParseError when episode count missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).message).toContain(
      "Episode count missing",
    );
  });

  it("collects ScraperParseError when upload date missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect((result.errors[0] as ScraperParseError).message).toContain(
      "Upload date missing",
    );
  });

  it("collects ScraperParseError when episode count parsing fails", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">Invalid</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    if (isError(result.errors[0])) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.EPISODE_COUNT);
      expect(result.errors[0].message).toContain(
        "Failed to parse episode count",
      );
    }
  });

  it("collects ScraperParseError when upload date parsing fails", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
          <p class="theme-time">年份：Invalid</p>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    if (isError(result.errors[0])) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.UPLOAD_DATE);
      expect(result.errors[0].message).toContain("Failed to parse upload date");
    }
  });

  it("returns error when fetchText fails in scrapeListPage", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(
      scraperService as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >,
      "fetchText",
    ).mockResolvedValue(error);
    const result = await scraperService.scrapeListPage(1);
    expect(result.value).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe(error);
  });
});

// --- scrapeAnimeDetails ---
describe("scraperService.scrapeAnimeDetails", () => {
  it("parses details correctly", async () => {
    mockFetch(
      makeHtml(`
      <div class="score-overall-number">8.5</div>
      <div class="score-overall-people">1,234人評價</div>
      <div class="data-intro"><p>Great show</p></div>
    `),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.score).toBe(8.5);
      expect(result.ratingCount).toBe(1234);
      expect(result.description).toBe("Great show");
    }
  });

  it("returns ScraperParseError when score missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.SCORE,
      );
    }
  });

  it("returns ScraperParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.SCORE,
      );
      expect(result.message).toContain("Failed to parse score");
    }
  });

  it("returns ScraperParseError when rating count missing", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">8.5</div>'));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.RATING_COUNT,
      );
    }
  });

  it("returns ScraperParseError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.RATING_COUNT,
      );
      expect(result.message).toContain("Failed to parse rating count");
    }
  });

  it("returns ScraperParseError when description missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">100人評價</div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.DESCRIPTION,
      );
    }
  });

  it("passes through ScraperHttpError from fetchText in scrapeAnimeDetails", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(
      scraperService as unknown as Record<
        string,
        (...args: unknown[]) => unknown
      >,
      "fetchText",
    ).mockResolvedValue(error);
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result).toBe(error);
  });
});

// --- Concurrency & Pipeline ---
describe("ScraperService concurrency methods", () => {
  it("fetchAllWithConcurrency aggregates results", async () => {
    const item = { title: "A" } as AnimeItem;
    vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      value: [item],
      errors: [],
    });
    const result = await scraperService.fetchAllWithConcurrency(2, 1, vi.fn());
    expect(result.value).toHaveLength(2);
  });

  it("fetchDetailsWithConcurrency returns empty result for empty items", async () => {
    const result = await scraperService.fetchDetailsWithConcurrency(
      [],
      1,
      vi.fn(),
    );
    expect(result.value).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("fetchDetailsWithConcurrency aggregates successful results", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const details = { score: 9.0, ratingCount: 100, description: "OK" };
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue(details);

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.value[0]).toEqual({ ...item, ...details });
  });

  it("fetchDetailsWithConcurrency aggregates errors", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const error = new ScraperHttpError("http://a", "fail", 500);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue(error);

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.value).toHaveLength(0);
    expect(res.errors[0]).toBe(error);
  });

  it("scanAllWithPipeline delegates to ScraperPipeline", async () => {
    const { ScraperPipeline } = await import("./scraperPipeline");
    const mockRes = { value: [], errors: [] };
    const spy = vi
      .spyOn(ScraperPipeline.prototype, "execute")
      .mockResolvedValue(mockRes);

    const result = await scraperService.scanAllWithPipeline(
      1,
      1,
      1,
      () => true,
      vi.fn(),
    );
    expect(result).toBe(mockRes);
    expect(spy).toHaveBeenCalled();
  });
});
