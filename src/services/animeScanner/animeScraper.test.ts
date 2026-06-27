import { describe, it, expect, vi, beforeEach } from "vitest";
import { animeScraper } from "./animeScraper";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanStep,
} from "./index";

const makeHtml = (innerHtml: string) =>
  `<html><body>${innerHtml}</body></html>`;

const mockFetch = (html: string, ok = true, status = 200) => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      status,
      text: async () => html,
      headers: {
        get: () => null,
      },
    }),
  );
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

// --- getTotalPages ---
describe("animeScraper.getTotalPages", () => {
  it("parses pagination correctly", async () => {
    mockFetch(
      makeHtml(`
      <div class="page_number">
        <a>1</a>
        <a>2</a>
        <a>3</a>
        <a>4</a>
      </div>
    `),
    );
    const pages = await animeScraper.getTotalPages();
    expect(pages).toBe(4);
  });

  it("throws AnimeScanParseError when pagination is missing", async () => {
    mockFetch(makeHtml("<div>No page links</div>"));
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when page text is empty", async () => {
    mockFetch(
      makeHtml(`
      <div class="page_number">
        <a></a>
      </div>
    `),
    );
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when page text is NaN", async () => {
    mockFetch(
      makeHtml(`
      <div class="page_number">
        <a>ABC</a>
      </div>
    `),
    );
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("bubbles up unexpected error inside getTotalPages", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected crash");
    });
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      "unexpected crash",
    );
  });

  it("bubbles up unexpected string error inside getTotalPages", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected string crash";
    });
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      "unexpected string crash",
    );
  });
});

// --- scrapeAnimesOnPage ---
describe("animeScraper.scrapeAnimesOnPage", () => {
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Anime");
    expect(result[0].episodeCount).toBe(12);
    expect(result[0].watchCount).toBe(25000);
    expect(result[0].uploadDate.getUTCFullYear()).toBe(2024);
  });

  it("throws AnimeScanParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when title textContent is exactly empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>',
      ),
    );
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when watch count is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
      </a>
    `),
    );
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("defaults watch count to 0 when watch count is NaN, '統計中', or invalid", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>統計中</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result[0].watchCount).toBe(0);

    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>InvalidCount</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
          <p class="theme-time">年份：2024</p>
        </div>
      </a>
    `),
    );
    const resultInvalid = await animeScraper.scrapeAnimesOnPage(1);
    expect(resultInvalid[0].watchCount).toBe(0);
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result[0].watchCount).toBe(25000);
  });

  it("throws error when fetchUrl fails in scrapeAnimesOnPage", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.SCRAPE_LIST_PAGE,
      "http://x",
      "fail",
      404,
      undefined,
    );
    vi.spyOn(
      animeScraper as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<string>;
      },
      "fetchUrl",
    ).mockRejectedValue(error);
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(error);
  });

  it("throws AnimeScanParseError when episode count parsing fails", async () => {
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
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when upload date parsing fails", async () => {
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
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("parses upload date with YYYY/MM format correctly", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>25,000</p>
        <div class="theme-detail-info-block">
          <span class="theme-number">共12集</span>
          <p class="theme-time">年份：2026/04</p>
        </div>
      </a>
    `),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result).toHaveLength(1);
    expect(result[0].uploadDate.getUTCFullYear()).toBe(2026);
    expect(result[0].uploadDate.getUTCMonth()).toBe(3); // April is index 3
  });

  it("throws AnimeScanParseError when detail block is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
      </a>
    `),
    );
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when episode count element is missing", async () => {
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
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when upload date element is missing", async () => {
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
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("bubbles up unexpected errors in scrapeAnimesOnPage", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected page crash");
    });
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      "unexpected page crash",
    );
  });

  it("bubbles up unexpected string errors in scrapeAnimesOnPage", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected page string crash";
    });
    await expect(animeScraper.scrapeAnimesOnPage(1)).rejects.toThrow(
      "unexpected page string crash",
    );
  });
});

// --- scrapeAnimeDetails ---
describe("animeScraper.scrapeAnimeDetails", () => {
  it("parses details correctly", async () => {
    mockFetch(
      makeHtml(`
      <div class="score-overall-number">8.5</div>
      <div class="score-overall-people">1,234人評價</div>
      <div class="data-intro"><p>Great show</p></div>
    `),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.score).toBe(8.5);
    expect(result.ratingCount).toBe(1234);
    expect(result.description).toBe("Great show");
  });

  it("returns default score 0 when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.score).toBe(0);
  });

  it("returns default score 0 when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.score).toBe(0);
  });

  it("returns default ratingCount 0 when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.ratingCount).toBe(0);
  });

  it("returns default ratingCount 0 when rating count element is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="data-intro"><p>Great show</p></div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.ratingCount).toBe(0);
  });

  it("returns empty description when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">1,234人評價</div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(result.description).toBe("");
  });

  it("throws AnimeScanHttpError from fetchUrl in scrapeAnimeDetails", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      "http://x",
      "fail",
      404,
      undefined,
    );
    vi.spyOn(
      animeScraper as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<string>;
      },
      "fetchUrl",
    ).mockRejectedValue(error);
    await expect(
      animeScraper.scrapeAnimeDetails("http://x", 1),
    ).rejects.toThrow(error);
  });

  it("bubbles up unexpected crash in scrapeAnimeDetails", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("crash");
    });
    await expect(
      animeScraper.scrapeAnimeDetails("http://x", 1),
    ).rejects.toThrow("crash");
  });

  it("bubbles up unexpected string crash in scrapeAnimeDetails", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "details string crash";
    });
    await expect(
      animeScraper.scrapeAnimeDetails("http://x", 1),
    ).rejects.toThrow("details string crash");
  });
});

// --- Pipeline ---
describe("AnimeScraper pipeline methods", () => {
  it("handles 429 response status and retries with backoff", async () => {
    const delaySpy = vi.spyOn(animeScraper, "delay").mockResolvedValue();
    let attempt = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => {
        attempt++;
        if (attempt === 1) {
          return {
            ok: false,
            status: 429,
            statusText: "Too Many Requests",
            headers: {
              get: (name: string) => (name === "Retry-After" ? "2" : null),
            },
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          text: async () => "Success after retry",
        };
      }),
    );

    const result = await (
      animeScraper as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<string>;
      }
    ).fetchUrl("http://example.com/retry", 1, AnimeScanStep.PARSE_ANIME_DETAIL);
    expect(result).toBe("Success after retry");
    expect(delaySpy).toHaveBeenCalledWith(2000); // 2 seconds * 1000ms
  });

  it("throws AnimeScanHttpError after maximum retries on 429", async () => {
    vi.spyOn(animeScraper, "delay").mockResolvedValue();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: {
          get: () => null,
        },
      }),
    );

    await expect(
      (
        animeScraper as unknown as {
          fetchUrl: (
            url: string,
            page: number,
            scanStep: AnimeScanStep,
          ) => Promise<string>;
        }
      ).fetchUrl(
        "http://example.com/retry-fail",
        1,
        AnimeScanStep.PARSE_ANIME_DETAIL,
      ),
    ).rejects.toThrow(AnimeScanHttpError);
  });

  it("delay resolves after timeout", async () => {
    const delaySpy = vi.spyOn(animeScraper, "delay");
    delaySpy.mockRestore();

    const start = Date.now();
    await animeScraper.delay(10);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(8);
  });

  it("throws AnimeScanHttpError when fetch throws unexpected error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Fetch failed")),
    );
    const scraper = animeScraper as unknown as {
      fetchUrl: (
        url: string,
        page: number,
        scanStep: AnimeScanStep,
      ) => Promise<string>;
    };
    await expect(
      scraper.fetchUrl("http://example.com", 1, AnimeScanStep.GET_TOTAL_PAGES),
    ).rejects.toThrow("HTTP request failed with status 0");
  });

  it("throws AnimeScanHttpError when fetch throws unexpected string error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("Fetch string error"));
    const scraper = animeScraper as unknown as {
      fetchUrl: (
        url: string,
        page: number,
        scanStep: AnimeScanStep,
      ) => Promise<string>;
    };
    try {
      await scraper.fetchUrl(
        "http://example.com",
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
      );
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AnimeScanHttpError);
      expect((err as AnimeScanHttpError).html).toBe("Fetch string error");
    }
  });

  it("handles snippet extraction failure in fetchUrl", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => {
          throw new Error("text read failed");
        },
        headers: {
          get: () => null,
        },
      }),
    );
    const scraper = animeScraper as unknown as {
      fetchUrl: (
        url: string,
        page: number,
        scanStep: AnimeScanStep,
      ) => Promise<string>;
    };
    await expect(
      scraper.fetchUrl("http://example.com", 1, AnimeScanStep.GET_TOTAL_PAGES),
    ).rejects.toThrow("HTTP request failed with status 500");
  });

  it("extracts snippet from error response body on non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Error response body contents",
        headers: {
          get: () => null,
        },
      }),
    );
    const scraper = animeScraper as unknown as {
      fetchUrl: (
        url: string,
        page: number,
        scanStep: AnimeScanStep,
      ) => Promise<string>;
    };
    try {
      await scraper.fetchUrl(
        "http://example.com",
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
      );
      expect.fail("Should have thrown");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AnimeScanHttpError);
      expect((err as AnimeScanHttpError).html).toBe(
        "Error response body contents",
      );
    }
  });
});
