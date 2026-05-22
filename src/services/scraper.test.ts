import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService, type AnimeItem } from "./scraper";

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
  it("throws error when no page links found", async () => {
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

  it("throws error when last page link has no textContent", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Last page link has no text content",
    );
  });

  it("throws error when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Invalid total pages parsed",
    );
  });

  it("throws error when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(scraperService.getTotalPages()).rejects.toThrow("network");
  });

  it("throws detailed error when response is not ok", async () => {
    mockFetch("", false, 404, "Not Found");
    await expect(scraperService.getTotalPages()).rejects.toThrow(
      "Failed to fetch https://ani.gamer.com.tw/animeList.php?page=1: 404 Not Found",
    );
  });
});

// --- scrapeListPage ---
describe("scraperService.scrapeListPage", () => {
  it("throws error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow("network");
  });

  it("returns empty array when no cards found", async () => {
    mockFetch(makeHtml("<div>nothing</div>"));
    expect(await scraperService.scrapeListPage(1)).toEqual([]);
  });

  it("throws error when response is not ok (404)", async () => {
    mockFetch("", false, 404, "Not Found");
    await expect(scraperService.scrapeListPage(1)).rejects.toThrow(
      "404 Not Found",
    );
  });

  it("skips cards without href", async () => {
    mockFetch(
      makeHtml(`<a class="theme-list-main"><p class="theme-name">Test</p></a>`),
    );
    expect(await scraperService.scrapeListPage(1)).toEqual([]);
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
    const results = await scraperService.scrapeListPage(1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Test Anime");
    expect(results[0].episode_count).toBe("12");
    expect(results[0].upload_date).toBe("2024");
    expect(results[0].link).toBe(
      "https://ani.gamer.com.tw/animeVideo.php?sn=123",
    );
  });

  it("sets empty title when theme-name element missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
      </a>
    `),
    );
    const results = await scraperService.scrapeListPage(1);
    expect(results[0].title).toBe("");
  });

  it("sets empty title when theme-name element exists but textContent is empty", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">   </p>
      </a>
    `),
    );
    const results = await scraperService.scrapeListPage(1);
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
    const results = await scraperService.scrapeListPage(1);
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
    const results = await scraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(25000);
  });

  it("handles watch count without 萬 suffix", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p>5,000</p>
        <p class="theme-name">Title</p>
      </a>
    `),
    );
    const results = await scraperService.scrapeListPage(1);
    expect(results[0].watch_count).toBe(5000);
  });
});

// --- scrapeAnimeDetails ---
describe("scraperService.scrapeAnimeDetails", () => {
  it("throws error on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    await expect(
      scraperService.scrapeAnimeDetails("http://example.com"),
    ).rejects.toThrow("network");
  });

  it("throws error when response is not ok", async () => {
    mockFetch("", false, 500, "Internal Error");
    await expect(
      scraperService.scrapeAnimeDetails("http://example.com"),
    ).rejects.toThrow("500 Internal Error");
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
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.score).toBe(8.5);
    expect(result.rating_count).toBe(1234);
    expect(result.description).toContain("Great anime");
  });

  it("returns default score and description when elements missing", async () => {
    mockFetch(makeHtml(`<div>Nothing</div>`));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.score).toBe(0);
    expect(result.description).toBe("No description found.");
  });

  it("handles non-numeric rating count", async () => {
    mockFetch(
      makeHtml(`
      <div class="score-overall-people">NaN人評價</div>
    `),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.rating_count).toBe(0);
  });
});

// --- fetchAllWithConcurrency ---
describe("scraperService.fetchAllWithConcurrency", () => {
  it("calls scrapeListPage for each page and aggregates results", async () => {
    const spy = vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue([
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
    const results = await scraperService.fetchAllWithConcurrency(
      3,
      2,
      onProgress,
    );
    expect(spy).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(3);
    expect(onProgress).toHaveBeenCalled();
  });
});
