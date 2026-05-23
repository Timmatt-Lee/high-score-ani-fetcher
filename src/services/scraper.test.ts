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

const mockFetch = (html: string, ok = true, status = 200, statusText = "OK") => {
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
    vi.spyOn(scraperService as unknown, "fetchText").mockResolvedValue(error);

    const result = await scraperService.getTotalPages();
    expect(result).toBe(error);
  });

  it("handles unexpected errors in getTotalPages catch block", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected crash");
    });
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("Unexpected parsing error");
    }
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
    const err = result.errors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when title textContent is exactly empty", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    const err = result.errors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    const err = result.errors[0];
    if (err instanceof ScraperParseError) {
      expect(err.message).toContain("Missing href");
    }
  });

  it("handles watch count with 萬 suffix", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">Title</p>
        <p>2.5萬</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.value[0].watchCount).toBe(25000);
  });

  it("returns error when fetchText fails in scrapeListPage", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(scraperService as unknown, "fetchText").mockResolvedValue(error);
    const result = await scraperService.scrapeListPage(1);
    expect(result.value).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe(error);
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
    const err = result.errors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.EPISODE_COUNT);
      expect(err.message).toContain("Failed to parse episode count");
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
    const err = result.errors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.UPLOAD_DATE);
      expect(err.message).toContain("Failed to parse upload date");
    }
  });

  it("handles unexpected errors in scrapeListPage catch block", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected page crash");
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain("Unexpected page parsing error");
  });

  it("handles unexpected parseAnimeCard crash in loop", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    vi.spyOn(scraperService as unknown, "parseAnimeCard").mockImplementation(() => {
       throw new Error("loop crash");
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors[0].message).toContain("Unexpected page parsing error");
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
    const result = await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.score).toBe(8.5);
      expect(result.ratingCount).toBe(1234);
      expect(result.description).toBe("Great show");
    }
  });

  it("returns ScraperParseError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result = await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as ScraperParseError).source).toBe(
        ScraperErrorSource.SCORE,
      );
    }
  });

  it("returns ScraperParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result = await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    const err = result as ScraperParseError;
    expect(err.source).toBe(ScraperErrorSource.SCORE);
    expect(err.message).toContain("Failed to parse score");
  });

  it("returns ScraperParseError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result = await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    const err = result as ScraperParseError;
    expect(err.source).toBe(ScraperErrorSource.RATING_COUNT);
    expect(err.message).toContain("Failed to parse rating count");
  });

  it("passes through ScraperHttpError from fetchText in scrapeAnimeDetails", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(scraperService as unknown, "fetchText").mockResolvedValue(error);
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result).toBe(error);
  });

  it("handles unexpected crash in scrapeAnimeDetails", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("crash");
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("Unexpected details parsing error");
    }
  });
});

// --- Concurrency ---
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

  it("fetchDetailsWithConcurrency aggregates results", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const details = { score: 9.0, ratingCount: 100, description: "OK" };
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue(
      details as never,
    );

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.value[0]).toEqual({ ...item, ...details });
  });

  it("fetchDetailsWithConcurrency handles errors", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const error = new ScraperHttpError("http://a", "fail", 500);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue(
      error as never,
    );

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.value).toHaveLength(0);
    expect(res.errors[0]).toBe(error);
  });
});
