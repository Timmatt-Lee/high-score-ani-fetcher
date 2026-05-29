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

  it("returns ScraperHttpError with empty snippet when response.text() throws an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => {
          throw new Error("Failed to read body");
        },
      }),
    );
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperHttpError);
      expect((result as ScraperHttpError).status).toBe(404);
      expect((result as ScraperHttpError).html).toBe("");
    }
  });

  it("returns ScraperHttpError with empty snippet when response.text() throws a string error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => {
          throw "string error";
        },
      }),
    );
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperHttpError);
      expect((result as ScraperHttpError).status).toBe(404);
      expect((result as ScraperHttpError).html).toBe("");
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

  it("handles fetch failure with string by returning ScraperHttpError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network string error"));
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(ScraperHttpError);
      expect((result as ScraperHttpError).html).toBe("network string error");
    }
  });

  it("passes through ScraperHttpError from fetchText in getTotalPages", async () => {
    const error = new ScraperHttpError("http://x", "fail", 502);
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockResolvedValue(error);

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

  it("handles unexpected string errors in getTotalPages catch block", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected string crash";
    });
    const result = await scraperService.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("unexpected string crash");
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
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Test Anime");
    expect(result.items[0].episodeCount).toBe(12);
    expect(result.items[0].watchCount).toBe(25000);
    expect(result.items[0].uploadDate.getFullYear()).toBe(2024);
  });

  it("collects ScraperParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.items).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when title textContent is exactly empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>',
      ),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.message).toContain("Missing href");
    }
  });

  it("collects ScraperParseError when watch count is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.WATCH_COUNT);
      expect(err.message).toContain("Watch count element missing");
    }
  });

  it("collects ScraperParseError when watch count is NaN", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>InvalidCount</p>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.WATCH_COUNT);
      expect(err.message).toContain("Failed to parse watch count");
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
    expect(result.items[0].watchCount).toBe(25000);
  });

  it("returns error when fetchText fails in scrapeListPage", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockResolvedValue(error);
    const result = await scraperService.scrapeListPage(1);
    expect(result.items).toHaveLength(0);
    expect(result.httpErrors).toHaveLength(1);
    expect(result.httpErrors[0]).toBe(error);
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
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
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
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.UPLOAD_DATE);
      expect(err.message).toContain("Failed to parse upload date");
    }
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
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.EPISODE_COUNT);
      expect(err.message).toContain("Detail block missing");
    }
  });

  it("collects ScraperParseError when episode count element is missing", async () => {
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
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.EPISODE_COUNT);
      expect(err.message).toContain("Episode count missing");
    }
  });

  it("collects ScraperParseError when upload date element is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
        </div>
      </a>
    `),
    );
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof ScraperParseError) {
      expect(err.source).toBe(ScraperErrorSource.UPLOAD_DATE);
      expect(err.message).toContain("Upload date missing");
    }
  });

  it("handles unexpected errors in scrapeListPage catch block", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected page crash");
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0].message).toContain(
      "Unexpected page parsing error",
    );
  });

  it("handles unexpected string errors in scrapeListPage catch block", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected page string crash";
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.parseErrors).toHaveLength(1);
    expect(result.parseErrors[0].message).toContain(
      "unexpected page string crash",
    );
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

  it("returns ScraperParseError when score is missing", async () => {
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
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    const err = result as ScraperParseError;
    expect(err.source).toBe(ScraperErrorSource.RATING_COUNT);
    expect(err.message).toContain("Failed to parse rating count");
  });

  it("returns ScraperParseError when rating count element is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="data-intro"><p>Great show</p></div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    const err = result as ScraperParseError;
    expect(err.source).toBe(ScraperErrorSource.RATING_COUNT);
    expect(err.message).toContain("Rating count element missing");
  });

  it("returns ScraperParseError when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">1,234人評價</div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(isError(result)).toBe(true);
    const err = result as ScraperParseError;
    expect(err.source).toBe(ScraperErrorSource.DESCRIPTION);
    expect(err.message).toContain("Description missing");
  });

  it("passes through ScraperHttpError from fetchText in scrapeAnimeDetails", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockResolvedValue(error);
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

  it("handles unexpected string crash in scrapeAnimeDetails", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "details string crash";
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("details string crash");
    }
  });
});

// --- Pipeline ---
describe("ScraperService pipeline methods", () => {
  it("scanAllWithPipeline delegates execution to ScraperPipeline", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      items: [item],
      httpErrors: [],
      parseErrors: [],
    });
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.5,
      ratingCount: 500,
      description: "Awesome",
    });

    const res = await scraperService.scanAllWithPipeline(
      1,
      1,
      1,
      () => true,
      vi.fn(),
    );
    expect(res.items).toHaveLength(1);
    expect(res.items[0].title).toBe("A");
    expect(res.items[0].score).toBe(9.5);
    expect(res.httpErrors).toHaveLength(0);
    expect(res.parseErrors).toHaveLength(0);
  });
});
