import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService, ScraperError } from "./scraper";
import { type AnimeItem } from "../types/anime";

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
  it("throws ScraperError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Pagination element not found",
    );
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

  it("throws ScraperError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Last page link has no text content",
    );
  });

  it("throws ScraperError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Invalid total pages parsed",
    );
  });

  it("throws ScraperError when response is not ok", async () => {
    mockFetch("Error Page Content", false, 404, "Not Found");
    try {
      await scraperService.getTotalPages();
    } catch (err) {
      const scraperErr = err as ScraperError;
      expect(scraperErr).toBeInstanceOf(ScraperError);
      expect(scraperErr.message).toContain("HTTP Request Failed");
      expect(scraperErr.htmlSnippet).toBe("Error Page Content");
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

  it("throws ScraperError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow(
      "Anime title missing",
    );
  });

  it("skips cards without href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const results = await scraperService.scrapeListPage(1);
    expect(results).toHaveLength(0);
  });

  it("throws ScraperError when watch count parsing fails", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>Invalid</p>
      </a>
    `),
    );
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow(
      "Failed to parse watch count",
    );
  });

  it("throws ScraperError when episode count parsing fails", async () => {
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
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow(
      "Failed to parse episode count",
    );
  });

  it("throws ScraperError when upload date parsing fails", async () => {
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
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow(
      "Failed to parse upload date",
    );
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

  it("throws ScraperError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    await expect(scraperService.scrapeAnimeDetails("http://x")).rejects.toThrow(
      "Score element missing",
    );
  });

  it("throws ScraperError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    await expect(scraperService.scrapeAnimeDetails("http://x")).rejects.toThrow(
      "Failed to parse score",
    );
  });

  it("throws ScraperError when rating count element missing", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">8.5</div>'));
    await expect(scraperService.scrapeAnimeDetails("http://x")).rejects.toThrow(
      "Rating count element missing",
    );
  });

  it("throws ScraperError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    await expect(scraperService.scrapeAnimeDetails("http://x")).rejects.toThrow(
      "Failed to parse rating count",
    );
  });

  it("throws ScraperError when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">100人評價</div>',
      ),
    );
    await expect(scraperService.scrapeAnimeDetails("http://x")).rejects.toThrow(
      "Description missing",
    );
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
