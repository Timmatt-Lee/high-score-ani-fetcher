import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScraperService, type AnimeItem } from "./scraper";

// --- Helpers ---
const makeHtml = (content: string) => `<html><body>${content}</body></html>`;

const mockFetch = (html: string, ok = true) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status: ok ? 200 : 404,
      text: async () => html,
    }),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
});

// --- getTotalPages ---
describe("ScraperService.getTotalPages", () => {
  it("returns 1 when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    expect(await ScraperService.getTotalPages()).toBe(1);
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
    expect(await ScraperService.getTotalPages()).toBe(5);
  });

  it("returns 1 when last page link has no textContent", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    expect(await ScraperService.getTotalPages()).toBe(1);
  });

  it("throws error when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(ScraperService.getTotalPages()).rejects.toThrow("network");
  });

  it("throws error when response is not ok", async () => {
    mockFetch("", false);
    await expect(ScraperService.getTotalPages()).rejects.toThrow(
      "HTTP error: 404",
    );
  });
});

// --- scrapeListPage ---
describe("ScraperService.scrapeListPage", () => {
  it("returns empty array on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    expect(await ScraperService.scrapeListPage(1)).toEqual([]);
  });

  it("returns empty array when no cards found", async () => {
    mockFetch(makeHtml("<div>nothing</div>"));
    expect(await ScraperService.scrapeListPage(1)).toEqual([]);
  });

  it("returns empty array when response is not ok (404)", async () => {
    mockFetch("", false);
    expect(await ScraperService.scrapeListPage(1)).toEqual([]);
  });

  it("skips cards without href", async () => {
    mockFetch(
      makeHtml(`<a class="theme-list-main"><p class="theme-name">Test</p></a>`),
    );
    expect(await ScraperService.scrapeListPage(1)).toEqual([]);
  });

  it("parses basic card info correctly", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test Anime");
    expect(results[0].episode_count).toBe("12");
    expect(results[0].upload_date).toBe("2024");
    expect(results[0].link).toContain("animeVideo.php?sn=123");
  });

  it("uses No Title fallback when theme-name element missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].title).toBe("No Title");
  });

  it("uses empty string when theme-name element exists but textContent is empty", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">   </p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].title).toBe("");
  });

  it("handles episode element with empty textContent", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">Title</p>
        <div class="theme-detail-info-block">
          <span class="theme-number"></span>
          <p class="theme-time"></p>
        </div>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].episode_count).toBe("N/A");
    expect(results[0].upload_date).toBe("N/A");
  });

  it("parses watch count with 萬 suffix", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p>2.5萬</p>
        <p class="theme-name">Title</p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(25000);
  });

  it("parses watch count without 萬 suffix", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p>5,000</p>
        <p class="theme-name">Title</p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(5000);
  });

  it("handles missing episode count gracefully", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">NoEp</p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].episode_count).toBe("N/A");
  });

  it("handles non-numeric watch count strings", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p>--</p>
        <p class="theme-name">Title</p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(0);
  });

  it("handles card with no p element for watch count", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">NoWatch</p>
      </a>
    `),
    );
    const results = await ScraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(0);
  });
});

// --- scrapeAnimeDetails ---
describe("ScraperService.scrapeAnimeDetails", () => {
  it("returns defaults on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.score).toBe(0);
    expect(result.rating_count).toBe(0);
    expect(result.description).toBe("Error fetching details");
  });

  it("parses score and rating count correctly", async () => {
    mockFetch(
      makeHtml(`
      <div class="acg-score">
        <div class="score-overall-number">8.5</div>
        <div class="score-overall-people">1,234人評價</div>
      </div>
      <div class="data-intro"><p>Great anime description here.</p></div>
    `),
    );
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.score).toBe(8.5);
    expect(result.rating_count).toBe(1234);
    expect(result.description).toContain("Great anime");
  });

  it("returns no description when div missing", async () => {
    mockFetch(
      makeHtml(`
      <div class="acg-score">
        <div class="score-overall-number">7.0</div>
      </div>
    `),
    );
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.description).toBe("No description found.");
  });

  it("truncates description to 200 chars", async () => {
    const longDesc = "A".repeat(300);
    mockFetch(
      makeHtml(`
      <div class="data-intro"><p>${longDesc}</p></div>
    `),
    );
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.description.length).toBeLessThanOrEqual(204); // 200 + '...'
  });

  it("handles non-numeric rating count gracefully", async () => {
    mockFetch(
      makeHtml(`
      <div class="acg-score">
        <div class="score-overall-number">7.5</div>
        <div class="score-overall-people">N/A人評價</div>
      </div>
    `),
    );
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.rating_count).toBe(0);
  });

  it("handles missing score element gracefully", async () => {
    mockFetch(makeHtml(`<div>no score here</div>`));
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.score).toBe(0);
  });

  it("returns error description when response is not ok", async () => {
    mockFetch("", false);
    const result =
      await ScraperService.scrapeAnimeDetails("http://example.com");
    expect(result.description).toBe("Error fetching details");
  });
});

// --- fetchAllWithConcurrency ---
describe("ScraperService.fetchAllWithConcurrency", () => {
  it("calls scrapeListPage for each page and aggregates results", async () => {
    const spy = vi.spyOn(ScraperService, "scrapeListPage").mockResolvedValue([
      {
        link: "a",
        title: "A",
        watch_count: 0,
        episode_count: "12",
        upload_date: "2024",
        score: 0,
        rating_count: 0,
        description: "",
      } as AnimeItem,
    ]);
    const onProgress = vi.fn();
    const results = await ScraperService.fetchAllWithConcurrency(
      3,
      2,
      onProgress,
    );
    expect(spy).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(onProgress).toHaveBeenCalled();
  });

  it("handles 0 pages gracefully", async () => {
    const results = await ScraperService.fetchAllWithConcurrency(0, 2, vi.fn());
    expect(results).toHaveLength(0);
  });
});
