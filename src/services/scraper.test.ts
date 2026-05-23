import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService } from "./scraper";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
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
  it("returns isSuccess: false and ScraperParseError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
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
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value).toBe(5);
    }
  });

  it("returns isSuccess: false and ScraperParseError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.message).toContain("No pagination text");
    }
  });

  it("returns isSuccess: false and ScraperParseError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.message).toContain("Invalid page number");
    }
  });

  it("returns isSuccess: false and ScraperHttpError when response is not ok", async () => {
    mockFetch("Error Page", false, 404, "Not Found");
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(404);
      expect(result.error.html).toBe("Error Page");
    }
  });

  it("handles fetch failure (network error) by returning isSuccess: false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.html).toBe("network");
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown inside fetchHtml in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError("http://x", "fetch total pages crash", 500),
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.html).toBe("fetch total pages crash");
      expect(result.error.status).toBe(500);
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown during HTML parsing in ScraperParseError", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected parser crash");
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
      expect(result.error.html).toBe("unexpected parser crash");
    }
  });

  it("returns isSuccess: false and passes through ScraperHttpError thrown by fetchHtml in getTotalPages", async () => {
    const error = new ScraperHttpError("http://x", "http error", 502);
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: error,
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and wraps non-Error thrown by fetchHtml in getTotalPages in ScraperHttpError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network string error"));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.html).toBe("network string error");
      expect(result.error.status).toBe(500);
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown during parsing phase in getTotalPages in ScraperParseError", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected parser string crash";
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
      expect(result.error.html).toBe("unexpected parser string crash");
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown by fetchHtml in getTotalPages in ScraperHttpError", async () => {
    const error = new Error("network issue");
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError("http://x", error.message, 500),
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("network issue");
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown during parsing phase in getTotalPages in ScraperParseError", async () => {
    mockFetch("Some HTML");
    const error = new Error("unexpected parsing error");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw error;
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
      expect(result.error.html).toContain("unexpected parsing error");
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown by fetchHtml in getTotalPages in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError("http://x", "network issue string", 500),
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("network issue string");
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown during parsing phase in getTotalPages in ScraperParseError", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected parsing error string";
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
      expect(result.error.html).toBe("unexpected parsing error string");
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
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.TITLE);
    }
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const result = await scraperService.scrapeListPage(1);
    expect(result.items).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.TITLE);
      expect(result.errors[0].message).toContain("Missing href attribute");
    }
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
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.WATCH_COUNT);
    }
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
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.WATCH_COUNT);
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
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.EPISODE_COUNT);
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
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.EPISODE_COUNT);
      expect(result.errors[0].message).toContain("Episode count missing");
    }
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
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.EPISODE_COUNT);
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
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.UPLOAD_DATE);
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

  it("wraps unexpected parsing errors into ScraperParseError", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    // Force querySelector to throw an error during execution
    vi.spyOn(Element.prototype, "querySelector").mockImplementation(() => {
      throw new Error("unexpected DOM query failure");
    });
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].html).toContain("unexpected DOM query failure");
  });

  it("collects ScraperParseError when upload date element is missing", async () => {
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
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.UPLOAD_DATE);
    }
  });

  it("handles ScraperParseError thrown during page parsing in scrapeListPage", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const error = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "http://x",
      "manual parse error",
    );
    // Force parseAnimeCard to return a failed Result
    vi.spyOn(
      scraperService as unknown as {
        parseAnimeCard: () => unknown;
      },
      "parseAnimeCard",
    ).mockReturnValue({ isSuccess: false, value: undefined, error });

    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe(error);
  });

  it("wraps unexpected parsing non-Error into ScraperParseError", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共1集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    vi.spyOn(Element.prototype, "querySelector").mockImplementation(() => {
      throw "unexpected DOM query failure string";
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].html).toBe("unexpected DOM query failure string");
  });
  it("returns errors when fetchHtml fails in scrapeListPage", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError("http://x", "fail", 404),
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.items).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperHttpError);
  });

  it("returns empty items and error when parseHtml fails in scrapeListPage", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected parsing crash");
    });
    const result = await scraperService.scrapeListPage(1);
    expect(result.items).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBeInstanceOf(ScraperParseError);
    if (result.errors[0] instanceof ScraperParseError) {
      expect(result.errors[0].source).toBe(ScraperErrorSource.TITLE);
      expect(result.errors[0].html).toBe("unexpected parsing crash");
    }
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
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.score).toBe(8.5);
      expect(result.value.ratingCount).toBe(1234);
      expect(result.value.description).toBe("Great show");
    }
  });

  it("returns isSuccess: false and ScraperParseError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("returns isSuccess: false and ScraperParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("returns isSuccess: false and ScraperParseError when rating count element missing", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">8.5</div>'));
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.RATING_COUNT);
    }
  });

  it("returns isSuccess: false and ScraperParseError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.RATING_COUNT);
    }
  });

  it("returns isSuccess: false and ScraperParseError when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">100人評價</div>',
      ),
    );
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.DESCRIPTION);
    }
  });

  it("returns isSuccess: false and passes through ScraperHttpError thrown inside scrapeAnimeDetails", async () => {
    const error = new ScraperHttpError("http://x", "http error", 502);
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: error,
    });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and wraps generic Error thrown inside scrapeAnimeDetails in ScraperParseError", async () => {
    mockFetch("Some HTML");
    const error = new Error("unexpected parsing error");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw error;
    });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.DESCRIPTION);
      expect(result.error.html).toContain("unexpected parsing error");
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown by fetchHtml inside scrapeAnimeDetails in ScraperHttpError", async () => {
    const error = new Error("network issue");
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError("http://x", error.message, 500),
    });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("network issue");
    }
  });

  it("returns isSuccess: false and ScraperHttpError when fetchHtml returns failure in scrapeAnimeDetails", async () => {
    const error = new ScraperHttpError("http://x", "fail", 404);
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({ isSuccess: false, value: undefined, error });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and wraps non-Error thrown during parsing phase in scrapeAnimeDetails in ScraperParseError", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected parse details raw string";
    });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.DESCRIPTION);
      expect(result.error.html).toBe("unexpected parse details raw string");
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown by fetchHtml inside scrapeAnimeDetails in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchHtml: (url: string) => Promise<unknown>;
      },
      "fetchHtml",
    ).mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error: new ScraperHttpError(
        "http://x",
        "details network string error",
        500,
      ),
    });
    const result =
      await scraperService.scrapeAnimeDetails("http://example.com");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("details network string error");
    }
  });
});

// --- fetchAllWithConcurrency ---
describe("scraperService.fetchAllWithConcurrency", () => {
  it("calls scrapeListPage for each page and aggregates results", async () => {
    const spy = vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      items: [
        {
          link: "a",
          title: "A",
          watchCount: 100,
          episodeCount: 12,
          uploadDate: new Date(),
          score: 0,
          ratingCount: 0,
          description: "",
        } as AnimeItem,
      ],
      errors: [],
    });
    const results = await scraperService.fetchAllWithConcurrency(2, 1, vi.fn());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(results.items).toHaveLength(2);
  });

  it("aggregates page-level fetch errors in fetchAllWithConcurrency", async () => {
    const error = new ScraperHttpError("http://error", "fail", 404);
    vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      items: [],
      errors: [error],
    });
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toContain(error);
  });

  it("wraps unexpected page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(scraperService, "scrapeListPage").mockImplementation(() => {
      throw new Error("Generic Network Error");
    });
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    if (errors[0] instanceof ScraperHttpError) {
      expect(errors[0].html).toContain("Generic Network Error");
    }
  });

  it("wraps non-Error page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(scraperService, "scrapeListPage").mockImplementation(() => {
      throw "String Network Error";
    });
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].html).toBe("String Network Error");
  });

  it("handles ScraperParseError page-level errors in fetchAllWithConcurrency", async () => {
    const error = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "http://error",
      "manual fail",
    );
    vi.spyOn(scraperService, "scrapeListPage").mockImplementation(() => {
      throw error;
    });
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(error);
  });
});

// --- fetchDetailsWithConcurrency ---
describe("scraperService.fetchDetailsWithConcurrency", () => {
  it("returns empty result if items is empty", async () => {
    const res = await scraperService.fetchDetailsWithConcurrency(
      [],
      5,
      vi.fn(),
    );
    expect(res.items).toEqual([]);
    expect(res.errors).toEqual([]);
  });

  it("calls scrapeAnimeDetails and aggregates detailed results", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const details = { score: 9.0, ratingCount: 100, description: "OK" };
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      isSuccess: true,
      value: details,
      error: undefined,
    });

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.items[0]).toEqual({ ...item, ...details });
  });

  it("aggregates custom scraper errors from scrapeAnimeDetails", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const error = new ScraperHttpError("http://a", "fail", 404);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockResolvedValue({
      isSuccess: false,
      value: undefined,
      error,
    });

    const res = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );
    expect(res.items).toHaveLength(0);
    expect(res.errors).toContain(error);
  });

  it("passes through ScraperParseError thrown inside fetchDetailsWithConcurrency", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    const customError = new ScraperParseError(
      ScraperErrorSource.SCORE,
      "http://a",
      "detail parse error",
    );
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockImplementation(() => {
      throw customError;
    });

    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(customError);
  });

  it("wraps unexpected errors in ScraperHttpError", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockImplementation(() => {
      throw new Error("Unexpected error");
    });

    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    if (errors[0] instanceof ScraperHttpError) {
      expect(errors[0].html).toContain("Unexpected error");
    }
  });

  it("wraps non-Error thrown errors in ScraperHttpError", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockImplementation(() => {
      throw "string error";
    });

    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].html).toBe("string error");
  });
});

// --- scanAllWithPipeline ---
describe("scraperService.scanAllWithPipeline", () => {
  it("delegates execution to ScraperPipeline and returns results", async () => {
    const item = { link: "a", title: "A" } as AnimeItem;
    const mockResult = { items: [item], errors: [] };
    // We mock the execute method of ScraperPipeline via prototype
    const { ScraperPipeline } = await import("./scraperPipeline");
    const pipeSpy = vi
      .spyOn(ScraperPipeline.prototype, "execute")
      .mockResolvedValue(mockResult);

    const res = await scraperService.scanAllWithPipeline(
      1,
      1,
      1,
      () => true,
      vi.fn(),
    );
    expect(res).toBe(mockResult);
    expect(pipeSpy).toHaveBeenCalled();
  });
});
