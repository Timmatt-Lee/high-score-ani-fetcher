import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService } from "./scraper";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../types/errors";
import { type AnimeItem } from "../types/anime";

// --- Helpers ---
const makeHtml = (content: string) => `<html><body>${content}</body></html>`;

const mockFetch = (html: string, ok = true, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: async () => html,
    }),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// --- getTotalPages ---
describe("scraperService.getTotalPages", () => {
  it("throws ScraperParseError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    try {
      await scraperService.getTotalPages();
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.PAGINATION);
      expect(parseErr.message).toContain("Parsing failed at PAGINATION");
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
    expect(await scraperService.getTotalPages()).toBe(5);
  });

  it("throws ScraperParseError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    try {
      await scraperService.getTotalPages();
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.PAGINATION);
    }
  });

  it("throws ScraperParseError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    try {
      await scraperService.getTotalPages();
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.PAGINATION);
    }
  });

  it("throws ScraperHttpError when response is not ok", async () => {
    mockFetch("Error Page Content", false, 404);
    try {
      await scraperService.getTotalPages();
      expect.fail("Should have thrown ScraperHttpError");
    } catch (err) {
      const httpErr = err as ScraperHttpError;
      expect(httpErr).toBeInstanceOf(ScraperHttpError);
      expect(httpErr.message).toContain("HTTP request failed with status 404");
      expect(httpErr.html).toBe("Error Page Content");
      expect(httpErr.status).toBe(404);
    }
  });

  it("handles fetch failure (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(scraperService.getTotalPages()).rejects.toThrow("network");
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
    const results = await scraperService.scrapeListPage(1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test Anime");
    expect(results[0].episode_count).toBe(12);
    expect(results[0].watch_count).toBe(25000);
    expect(results[0].upload_date.getFullYear()).toBe(2024);
  });

  it("throws ScraperParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    try {
      await scraperService.scrapeListPage(1);
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("skips cards without href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const results = await scraperService.scrapeListPage(1);
    expect(results).toHaveLength(0);
  });

  it("throws ScraperParseError when watch count parsing fails", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>Invalid</p>
      </a>
    `),
    );
    try {
      await scraperService.scrapeListPage(1);
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.WATCH_COUNT);
    }
  });

  it("throws ScraperParseError when episode count parsing fails", async () => {
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
    try {
      await scraperService.scrapeListPage(1);
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.EPISODE_COUNT);
    }
  });

  it("throws ScraperParseError when upload date parsing fails", async () => {
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
    try {
      await scraperService.scrapeListPage(1);
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.UPLOAD_DATE);
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
    const results = await scraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(25000);
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
    expect(result.score).toBe(8.5);
    expect(result.rating_count).toBe(1234);
    expect(result.description).toBe("Great show");
  });

  it("throws ScraperParseError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    try {
      await scraperService.scrapeAnimeDetails("http://x");
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("throws ScraperParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    try {
      await scraperService.scrapeAnimeDetails("http://x");
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("throws ScraperParseError when rating count element missing", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">8.5</div>'));
    try {
      await scraperService.scrapeAnimeDetails("http://x");
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.RATING_COUNT);
    }
  });

  it("throws ScraperParseError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    try {
      await scraperService.scrapeAnimeDetails("http://x");
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.RATING_COUNT);
    }
  });

  it("throws ScraperParseError when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">100人評價</div>',
      ),
    );
    try {
      await scraperService.scrapeAnimeDetails("http://x");
      expect.fail("Should have thrown ScraperParseError");
    } catch (err) {
      const parseErr = err as ScraperParseError;
      expect(parseErr).toBeInstanceOf(ScraperParseError);
      expect(parseErr.source).toBe(ScraperErrorSource.DESCRIPTION);
    }
  });
});

// --- fetchAllWithConcurrency ---
describe("scraperService.fetchAllWithConcurrency", () => {
  it("calls scrapeListPage for each page and aggregates results", async () => {
    const spy = vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue([
      {
        link: "a",
        title: "A",
        watch_count: 100,
        episode_count: 12,
        upload_date: new Date(),
        score: 0,
        rating_count: 0,
        description: "",
      } as AnimeItem,
    ]);
    const results = await scraperService.fetchAllWithConcurrency(2, 1, vi.fn());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(results).toHaveLength(2);
  });
});
