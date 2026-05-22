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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(parseErrors).toHaveLength(0);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Test Anime");
    expect(items[0].episode_count).toBe(12);
    expect(items[0].watch_count).toBe(25000);
    expect(items[0].upload_date.getFullYear()).toBe(2024);
  });

  it("collects ScraperParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.TITLE);
  });

  it("collects ScraperParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.TITLE);
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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.WATCH_COUNT);
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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.EPISODE_COUNT);
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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.UPLOAD_DATE);
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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(parseErrors).toHaveLength(0);
    expect(items[0].watch_count).toBe(25000);
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
    const { items, parseErrors } = await scraperService.scrapeListPage(1);
    expect(items).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
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
    const spy = vi.spyOn(scraperService, "scrapeListPage").mockResolvedValue({
      items: [
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
      ],
      parseErrors: [],
    });
    const { items, httpErrors, parseErrors } =
      await scraperService.fetchAllWithConcurrency(2, 1, vi.fn());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(2);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
  });

  it("aggregates page-level fetch errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as { fetchText: () => Promise<string> },
      "fetchText",
    ).mockRejectedValue(
      new ScraperHttpError("http://error", "Error text", 404),
    );
    const { items, httpErrors, parseErrors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].status).toBe(404);
  });

  it("wraps unexpected page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as { fetchText: () => Promise<string> },
      "fetchText",
    ).mockRejectedValue(new Error("Generic Network Error"));
    const { items, httpErrors, parseErrors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].html).toContain("Generic Network Error");
  });

  it("wraps non-Error page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as { fetchText: () => Promise<string> },
      "fetchText",
    ).mockRejectedValue("String Network Error");
    const { items, httpErrors, parseErrors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(1);
    expect(parseErrors).toHaveLength(0);
    expect(httpErrors[0]).toBeInstanceOf(ScraperHttpError);
    expect(httpErrors[0].html).toBe("String Network Error");
  });

  it("handles ScraperParseError page-level errors in fetchAllWithConcurrency", async () => {
    vi.spyOn(
      scraperService as unknown as { fetchText: () => Promise<string> },
      "fetchText",
    ).mockRejectedValue(
      new ScraperParseError(
        ScraperErrorSource.TITLE,
        "http://error",
        "parse error",
      ),
    );
    const { items, httpErrors, parseErrors } =
      await scraperService.fetchAllWithConcurrency(1, 1, vi.fn());
    expect(items).toHaveLength(0);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(1);
    expect(parseErrors[0]).toBeInstanceOf(ScraperParseError);
    expect(parseErrors[0].source).toBe(ScraperErrorSource.TITLE);
  });
});

// --- fetchDetailsWithConcurrency ---
describe("scraperService.fetchDetailsWithConcurrency", () => {
  const makeItem = (title: string, link: string): AnimeItem =>
    ({
      link,
      title,
      watch_count: 100,
      episode_count: 12,
      upload_date: new Date(),
      score: 0,
      rating_count: 0,
      description: "",
    }) as AnimeItem;

  it("returns empty result if items is empty", async () => {
    const { items, errors } = await scraperService.fetchDetailsWithConcurrency(
      [],
      5,
      vi.fn(),
    );
    expect(items).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it("calls scrapeAnimeDetails and aggregates detailed results", async () => {
    const spy = vi
      .spyOn(scraperService, "scrapeAnimeDetails")
      .mockResolvedValue({
        score: 9.0,
        rating_count: 100,
        description: "Desc",
      });

    const item1 = makeItem("A", "http://a");
    const item2 = makeItem("B", "http://b");

    const onProgress = vi.fn();
    const { items, errors } = await scraperService.fetchDetailsWithConcurrency(
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
      rating_count: 100,
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
          return { score: 8.0, rating_count: 50, description: "A" };
        }
        throw customError;
      },
    );

    const item1 = makeItem("A", "http://a");
    const item2 = makeItem("B", "http://b");

    const { items, errors } = await scraperService.fetchDetailsWithConcurrency(
      [item1, item2],
      2,
      vi.fn(),
    );

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("A");
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBe(customError);
  });

  it("wraps unexpected errors in ScraperHttpError", async () => {
    vi.spyOn(scraperService, "scrapeAnimeDetails").mockRejectedValue(
      new Error("Unexpected error"),
    );

    const item = makeItem("A", "http://a");
    const { items, errors } = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );

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
    const { items, errors } = await scraperService.fetchDetailsWithConcurrency(
      [item],
      1,
      vi.fn(),
    );

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
      parseErrors: [],
    });
    const result = await scraperService.scanAllWithPipeline(
      1,
      1,
      1,
      () => true,
      vi.fn(),
    );
    expect(result).toEqual({ items: [], httpErrors: [], parseErrors: [] });
  });
});
