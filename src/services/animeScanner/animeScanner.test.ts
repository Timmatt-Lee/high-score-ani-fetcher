import { describe, it, expect, vi, beforeEach } from "vitest";
import { animeScanner, AnimeScanner } from "./animeScanner";
import { type AnimeInfo, type AnimeDetails } from "./types";
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
describe("animeScanner.getTotalPages", () => {
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
    const pages = await animeScanner.getTotalPages();
    expect(pages).toBe(4);
  });

  it("throws AnimeScanParseError when pagination is missing", async () => {
    mockFetch(makeHtml("<div>No page links</div>"));
    await expect(animeScanner.getTotalPages()).rejects.toThrow(
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
    await expect(animeScanner.getTotalPages()).rejects.toThrow(
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
    await expect(animeScanner.getTotalPages()).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("bubbles up unexpected error inside getTotalPages", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected crash");
    });
    await expect(animeScanner.getTotalPages()).rejects.toThrow(
      "unexpected crash",
    );
  });

  it("bubbles up unexpected string error inside getTotalPages", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected string crash";
    });
    await expect(animeScanner.getTotalPages()).rejects.toThrow(
      "unexpected string crash",
    );
  });
});

// --- scanAnimesOnPage ---
describe("animeScanner.scanAnimesOnPage", () => {
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
    const result = await animeScanner.scanAnimesOnPage(1);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Test Anime");
    expect(result[0].episodeCount).toBe(12);
    expect(result[0].watchCount).toBe(25000);
    expect(new Date(result[0].uploadDate).getUTCFullYear()).toBe(2024);
  });

  it("throws AnimeScanParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when title textContent is exactly empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>',
      ),
    );
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("throws AnimeScanParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    const result = await animeScanner.scanAnimesOnPage(1);
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
    const resultInvalid = await animeScanner.scanAnimesOnPage(1);
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
    const result = await animeScanner.scanAnimesOnPage(1);
    expect(result[0].watchCount).toBe(25000);
  });

  it("throws error when fetchUrl fails in scanAnimesOnPage", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.SCAN_LIST_PAGE,
      "http://x",
      "fail",
      404,
      undefined,
    );
    vi.spyOn(
      animeScanner as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<string>;
      },
      "fetchUrl",
    ).mockRejectedValue(error);
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(error);
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    const result = await animeScanner.scanAnimesOnPage(1);
    expect(result).toHaveLength(1);
    expect(new Date(result[0].uploadDate).getUTCFullYear()).toBe(2026);
    expect(new Date(result[0].uploadDate).getUTCMonth()).toBe(3); // April is index 3
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
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
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
      AnimeScanParseError,
    );
  });

  it("bubbles up unexpected errors in scanAnimesOnPage", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected page crash");
    });
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
      "unexpected page crash",
    );
  });

  it("bubbles up unexpected string errors in scanAnimesOnPage", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "unexpected page string crash";
    });
    await expect(animeScanner.scanAnimesOnPage(1)).rejects.toThrow(
      "unexpected page string crash",
    );
  });
});

// --- scanAnimeDetail ---
describe("animeScanner.scanAnimeDetail", () => {
  it("parses details correctly", async () => {
    mockFetch(
      makeHtml(`
      <div class="score-overall-number">8.5</div>
      <div class="score-overall-people">1,234人評價</div>
      <div class="data-intro"><p>Great show</p></div>
    `),
    );
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.score).toBe(8.5);
    expect(result.ratingCount).toBe(1234);
    expect(result.description).toBe("Great show");
  });

  it("returns default score 0 when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.score).toBe(0);
  });

  it("returns default score 0 when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.score).toBe(0);
  });

  it("returns default ratingCount 0 when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.ratingCount).toBe(0);
  });

  it("returns default ratingCount 0 when rating count element is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="data-intro"><p>Great show</p></div>',
      ),
    );
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.ratingCount).toBe(0);
  });

  it("returns empty description when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">1,234人評價</div>',
      ),
    );
    const result = await animeScanner.scanAnimeDetail("http://example.com", 1);
    expect(result.description).toBe("");
  });

  it("throws AnimeScanHttpError from fetchUrl in scanAnimeDetail", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      "http://x",
      "fail",
      404,
      undefined,
    );
    vi.spyOn(
      animeScanner as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<string>;
      },
      "fetchUrl",
    ).mockRejectedValue(error);
    await expect(animeScanner.scanAnimeDetail("http://x", 1)).rejects.toThrow(
      error,
    );
  });

  it("bubbles up unexpected crash in scanAnimeDetail", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("crash");
    });
    await expect(animeScanner.scanAnimeDetail("http://x", 1)).rejects.toThrow(
      "crash",
    );
  });

  it("bubbles up unexpected string crash in scanAnimeDetail", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw "details string crash";
    });
    await expect(animeScanner.scanAnimeDetail("http://x", 1)).rejects.toThrow(
      "details string crash",
    );
  });
});

describe("AnimeScanParseError", () => {
  it("uses default message when no custom message is provided", () => {
    const error = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "http://example.com",
      "<html>bad</html>",
    );
    expect(error.message).toBe(
      "Parsing failed at parse_anime_info (URL: http://example.com)",
    );
    expect(error.html).toBe("<html>bad</html>");
  });

  it("uses custom message when provided", () => {
    const error = new AnimeScanParseError(
      1,
      AnimeScanStep.PARSE_ANIME_INFO,
      "http://example.com",
      "<html>bad</html>",
      "Custom error message",
    );
    expect(error.message).toBe("Custom error message");
  });
});

// --- Pipeline ---
describe("AnimeScanner pipeline methods", () => {
  it("delay resolves after timeout", async () => {
    const delaySpy = vi.spyOn(animeScanner, "delay");
    delaySpy.mockRestore();

    const start = Date.now();
    await animeScanner.delay(10);
    const end = Date.now();
    expect(end - start).toBeGreaterThanOrEqual(8);
  });

  it("throws AnimeScanHttpError when fetch throws unexpected error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Fetch failed")),
    );
    const scraper = animeScanner as unknown as {
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
    const scraper = animeScanner as unknown as {
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
    const scraper = animeScanner as unknown as {
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
    const scraper = animeScanner as unknown as {
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

  describe("scanPages", () => {
    it("scrapes index pages sequentially and collects all items", async () => {
      const listSpy = vi.fn();
      listSpy.mockResolvedValueOnce([
        { link: "http://a", title: "A" } as AnimeInfo,
        { link: "http://b", title: "B" } as AnimeInfo,
      ]);
      listSpy.mockResolvedValueOnce([
        { link: "http://c", title: "C" } as AnimeInfo,
      ]);

      const onPageScanned = vi.fn();
      const delaySpy = vi.fn().mockResolvedValue(undefined);

      const scanner = new AnimeScanner();
      scanner.scanAnimesOnPage = listSpy;
      scanner.delay = delaySpy;

      const results = await scanner.scanPages({
        totalPages: 2,
        requestDelayMs: 10,
        onPageScanned,
      });

      expect(listSpy).toHaveBeenCalledTimes(2);
      expect(onPageScanned).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1); // 1 delay between page 1 and page 2
      expect(results).toHaveLength(3);
      expect(results[0].title).toBe("A");
      expect(results[2].title).toBe("C");
    });

    it("propagates scanning errors", async () => {
      const listSpy = vi.fn().mockRejectedValue(new Error("network error"));

      const scanner = new AnimeScanner();
      scanner.scanAnimesOnPage = listSpy;

      await expect(
        scanner.scanPages({
          totalPages: 1,
          requestDelayMs: 0,
          onPageScanned: vi.fn(),
        }),
      ).rejects.toThrow("network error");
    });

    it("stops immediately if aborted by signal", async () => {
      const listSpy = vi.fn().mockResolvedValue([]);

      const controller = new AbortController();
      controller.abort();

      const scanner = new AnimeScanner();
      scanner.scanAnimesOnPage = listSpy;
      scanner.delay = vi.fn().mockResolvedValue(undefined);

      await expect(
        scanner.scanPages({
          totalPages: 5,
          requestDelayMs: 0,
          onPageScanned: vi.fn(),
          signal: controller.signal,
        }),
      ).rejects.toThrow(/aborted/);

      expect(listSpy).not.toHaveBeenCalled();
    });
  });

  describe("scanAnimeDetails", () => {
    it("scrapes detail pages sequentially and maps fields", async () => {
      const items = [
        { link: "http://a", title: "A" } as AnimeInfo,
        { link: "http://b", title: "B" } as AnimeInfo,
      ];

      const detailSpy = vi.fn().mockImplementation(async (link: string) => {
        const char = link.split("/").pop();
        return {
          score: 9.0,
          ratingCount: 100,
          description: `Desc ${char?.toUpperCase()}`,
        } as AnimeDetails;
      });

      const onDetailScanned = vi.fn();
      const delaySpy = vi.fn().mockResolvedValue(undefined);

      const scanner = new AnimeScanner();
      scanner.scanAnimeDetail = detailSpy;
      scanner.delay = delaySpy;

      await scanner.scanAnimeDetails({
        items,
        requestDelayMs: 10,
        onDetailScanned,
      });

      expect(detailSpy).toHaveBeenCalledTimes(2);
      expect(onDetailScanned).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledTimes(1); // 1 delay between item 1 and item 2

      const call1 = onDetailScanned.mock.calls[0];
      expect(call1[0].title).toBe("A");
      expect(call1[0].score).toBe(9.0);
      expect(call1[0].description).toBe("Desc A");
      expect(call1[0].scannedAt).toBeDefined();
    });

    it("propagates page-level Parse/HTTP errors", async () => {
      const detailError = new AnimeScanHttpError(
        1,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        "http://a",
        "fail",
        500,
        undefined,
      );

      const scanner = new AnimeScanner();
      scanner.scanAnimeDetail = vi.fn().mockRejectedValue(detailError);

      await expect(
        scanner.scanAnimeDetails({
          items: [{ link: "http://a", title: "A" } as AnimeInfo],
          requestDelayMs: 0,
          onDetailScanned: vi.fn(),
        }),
      ).rejects.toThrow(detailError);
    });

    it("stops immediately if aborted by signal", async () => {
      const detailSpy = vi.fn().mockResolvedValue({});

      const controller = new AbortController();
      controller.abort();

      const scanner = new AnimeScanner();
      scanner.scanAnimeDetail = detailSpy;
      scanner.delay = vi.fn().mockResolvedValue(undefined);

      await expect(
        scanner.scanAnimeDetails({
          items: [{ link: "http://a", title: "A" } as AnimeInfo],
          requestDelayMs: 0,
          onDetailScanned: vi.fn(),
          signal: controller.signal,
        }),
      ).rejects.toThrow(/aborted/);

      expect(detailSpy).not.toHaveBeenCalled();
    });
  });
});
