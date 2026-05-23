import { describe, it, expect, vi, beforeEach } from "vitest";
import { scraperService } from "./scraper";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
import { type AnimeItem } from "../types/anime";
import { type Result } from "../types/result";

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
  it("returns isSuccess: false and ScraperParseError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
      expect(result.error.message).toContain("Parsing failed at PAGINATION");
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
    expect(result.items).toBe(5);
  });

  it("returns isSuccess: false and ScraperParseError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
    }
  });

  it("returns isSuccess: false and ScraperParseError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.PAGINATION);
    }
  });

  it("returns isSuccess: false and ScraperHttpError when response is not ok", async () => {
    mockFetch("Error Page Content", false, 404);
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.message).toContain(
        "HTTP request failed with status 404",
      );
      expect(result.error.html).toBe("Error Page Content");
      expect(result.error.status).toBe(404);
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

  it("returns isSuccess: false and wraps generic Error thrown inside fetchText in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue(new Error("fetch total pages crash"));
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

  it("returns isSuccess: false and passes through ScraperHttpError thrown by fetchText in getTotalPages", async () => {
    const error = new ScraperHttpError("http://x", "http error", 502);
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue(error);
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and wraps non-Error thrown by fetchText in getTotalPages in ScraperHttpError", async () => {
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

  it("returns isSuccess: false and wraps generic Error thrown by fetchText in getTotalPages in ScraperHttpError", async () => {
    const error = new Error("network issue");
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue(error);
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("network issue");
    }
  });

  it("returns isSuccess: false and passes through ScraperParseError thrown during parsing phase in getTotalPages", async () => {
    mockFetch("Some HTML");
    const error = new ScraperParseError(
      ScraperErrorSource.PAGINATION,
      "http://x",
      "parse fail",
    );
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw error;
    });
    const result = await scraperService.getTotalPages();
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
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

  it("returns isSuccess: false and wraps non-Error thrown by fetchText in getTotalPages in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue("network issue string");
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(parseErrors).toHaveLength(0);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Test Anime");
    expect(items[0].episodeCount).toBe(12);
    expect(items[0].watchCount).toBe(25000);
    expect(items[0].uploadDate.getFullYear()).toBe(2024);
  });

  it("collects ScraperParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.TITLE,
    );
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.TITLE,
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.WATCH_COUNT,
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.EPISODE_COUNT,
    );
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.UPLOAD_DATE,
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(parseErrors).toHaveLength(0);
    expect(items[0].watchCount).toBe(25000);
  });

  it("wraps unexpected parsing errors into ScraperParseError", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">Title</p>
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
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.UPLOAD_DATE,
    );
  });

  it("handles ScraperParseError thrown during page parsing in scrapeListPage", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
      </a>
    `),
    );
    const error = new ScraperParseError(
      ScraperErrorSource.TITLE,
      "http://x",
      "forced parse err",
    );
    vi.spyOn(
      scraperService as unknown as {
        parseAnimeCard: (...args: never[]) => unknown;
      },
      "parseAnimeCard",
    ).mockImplementation(() => {
      throw error;
    });
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBe(error);
  });

  it("wraps unexpected parsing non-Error into ScraperParseError", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/anime.php">
        <p class="theme-name">Title</p>
      </a>
    `),
    );
    vi.spyOn(Element.prototype, "querySelector").mockImplementation(() => {
      throw "unexpected DOM query failure string";
    });
    const { items: items, errors: parseErrors } =
      await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect((parseErrors[0] as ScraperParseError).html).toBe(
      "unexpected DOM query failure string",
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
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.items.score).toBe(8.5);
      expect(result.items.ratingCount).toBe(1234);
      expect(result.items.description).toBe("Great show");
    }
  });

  it("returns isSuccess: false and ScraperParseError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("returns isSuccess: false and ScraperParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.SCORE);
    }
  });

  it("returns isSuccess: false and ScraperParseError when rating count element missing", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">8.5</div>'));
    const result = await scraperService.scrapeAnimeDetails("http://x");
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
    const result = await scraperService.scrapeAnimeDetails("http://x");
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
    const result = await scraperService.scrapeAnimeDetails("http://x");
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
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue(error);
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and wraps generic Error thrown inside scrapeAnimeDetails in ScraperParseError", async () => {
    mockFetch("Some HTML");
    const error = new Error("unexpected parsing error");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw error;
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.DESCRIPTION);
      expect(result.error.html).toContain("unexpected parsing error");
    }
  });

  it("returns isSuccess: false and wraps generic Error thrown by fetchText inside scrapeAnimeDetails in ScraperHttpError", async () => {
    const error = new Error("network issue");
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue(error);
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(500);
      expect(result.error.html).toBe("network issue");
    }
  });

  it("returns isSuccess: false and passes through ScraperParseError thrown during parsing phase in scrapeAnimeDetails", async () => {
    mockFetch("Some HTML");
    const error = new ScraperParseError(
      ScraperErrorSource.SCORE,
      "http://x",
      "parse fail",
    );
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw error;
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBe(error);
  });

  it("returns isSuccess: false and ScraperHttpError when fetchText returns failure in scrapeAnimeDetails", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockResolvedValue({
      isSuccess: false,
      items: null,
      error: new ScraperHttpError("http://x", "Not Found", 404),
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperHttpError);
    if (!result.isSuccess && result.error instanceof ScraperHttpError) {
      expect(result.error.status).toBe(404);
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown during parsing phase in scrapeAnimeDetails in ScraperParseError", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected parse details raw string";
    });
    const result = await scraperService.scrapeAnimeDetails("http://x");
    expect(result.isSuccess).toBe(false);
    expect(result.error).toBeInstanceOf(ScraperParseError);
    if (!result.isSuccess && result.error instanceof ScraperParseError) {
      expect(result.error.source).toBe(ScraperErrorSource.DESCRIPTION);
      expect(result.error.html).toBe("unexpected parse details raw string");
    }
  });

  it("returns isSuccess: false and wraps non-Error thrown by fetchText inside scrapeAnimeDetails in ScraperHttpError", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: (url: string) => Promise<unknown>;
      },
      "fetchText",
    ).mockRejectedValue("details network string error");
    const result = await scraperService.scrapeAnimeDetails("http://x");
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
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(2, 1, vi.fn());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("aggregates page-level fetch errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: () => Promise<Result<string, ScraperHttpError>>;
      },
      "fetchText",
    ).mockResolvedValue({
      isSuccess: false,
      items: null,
      error: new ScraperHttpError("http://error", "Error text", 404),
    });
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).status).toBe(404);
  });

  it("wraps unexpected page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: () => Promise<Result<string, ScraperHttpError>>;
      },
      "fetchText",
    ).mockRejectedValue(new Error("Generic Network Error"));
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).html).toContain(
      "Generic Network Error",
    );
  });

  it("wraps non-Error page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: () => Promise<Result<string, ScraperHttpError>>;
      },
      "fetchText",
    ).mockRejectedValue("String Network Error");
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).html).toBe("String Network Error");
  });

  it("handles ScraperParseError page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as {
        fetchText: () => Promise<Result<string, ScraperHttpError>>;
      },
      "fetchText",
    ).mockRejectedValue(
      new ScraperParseError(
        ScraperErrorSource.TITLE,
        "http://error",
        "parse error",
      ),
    );
    const { items: items, errors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperParseError);
    expect((errors[0] as ScraperParseError).source).toBe(
      ScraperErrorSource.TITLE,
    );
  });
});

// --- fetchDetailsWithConcurrency ---
describe("scraperService.fetchDetailsWithConcurrency", () => {
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

  it("returns empty result if items is empty", async () => {
    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([], 5, vi.fn());
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("calls scrapeAnimeDetails and aggregates detailed results", async () => {
    const spy = vi
      .spyOn(scraperService, "scrapeAnimeDetails")
      .mockResolvedValue({
        isSuccess: true,
        items: {
          score: 9.0,
          ratingCount: 100,
          description: "Desc",
        },
        error: null,
      });

    const item1 = makeItem("A", "http://a");
    const item2 = makeItem("B", "http://b");

    const onProgress = vi.fn();
    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency(
        [item1, item2],
        2,
        onProgress,
      );

    expect(spy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
    expect(errors).toHaveLength(0);

    expect(items[0]).toEqual({
      ...item1,
      score: 9.0,
      ratingCount: 100,
      description: "Desc",
    });

    // progress callback is called at least once per start and completion
    expect(onProgress).toHaveBeenCalled();
  });

  it("aggregates custom scraper errors from scrapeAnimeDetails", async () => {
    const customError = new ScraperHttpError("http://b", "Failed page", 404);
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockImplementation(
      async (link) => {
        if (link === "http://a") {
          return {
            isSuccess: true,
            items: { score: 8.0, ratingCount: 50, description: "A" },
            error: null,
          };
        }
        return {
          isSuccess: false,
          items: null,
          error: customError,
        };
      },
    );

    const item1 = makeItem("A", "http://a");
    const item2 = makeItem("B", "http://b");

    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency(
        [item1, item2],
        2,
        vi.fn(),
      );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("A");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(customError);
  });

  it("passes through ScraperParseError thrown inside fetchDetailsWithConcurrency", async () => {
    const customError = new ScraperParseError(
      ScraperErrorSource.SCORE,
      "http://a",
      "detail parse error",
    );
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      customError,
    );

    const item = makeItem("A", "http://a");
    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());

    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(customError);
  });

  it("wraps unexpected errors in ScraperHttpError", async () => {
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      new Error("Unexpected error"),
    );

    const item = makeItem("A", "http://a");
    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());

    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).html).toBe("Unexpected error");
  });

  it("wraps non-Error thrown errors in ScraperHttpError", async () => {
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      "string error",
    );

    const item = makeItem("A", "http://a");
    const { items: items, errors } =
      await scraperService.fetchDetailsWithConcurrency([item], 1, vi.fn());

    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(ScraperHttpError);
    expect((errors[0] as ScraperHttpError).html).toBe("string error");
  });
});

// --- scanAllWithPipeline ---
describe("scraperService.scanAllWithPipeline", () => {
  it("delegates execution to ScraperPipeline and returns results", async () => {
    vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      items: [],
      errors: [],
    });
    const result = await scraperService.scanAllWithPipeline(
      1,
      1,
      1,
      () => true,
      vi.fn(),
    );
    expect(result).toEqual({ items: [], errors: [] });
  });
});
