import { describe, it, expect, vi, beforeEach } from "vitest";
import { animeScraper } from "./animeScraper";
import {
  AnimeScanStep,
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanner,
} from "./index";
import { type AnimeItem, type AnimeScanEvent } from "./types";
import { isError } from "../../types/result";

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
describe("animeScraper.getTotalPages", () => {
  it("returns AnimeScanParseError when no page links found", async () => {
    mockFetch(makeHtml('<div class="page_number"></div>'));
    const result = await animeScraper.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(AnimeScanParseError);
      expect((result as AnimeScanParseError).scanStep).toBe(
        AnimeScanStep.GET_TOTAL_PAGES,
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
    const result = await animeScraper.getTotalPages();
    expect(isError(result)).toBe(false);
    expect(result).toBe(5);
  });

  it("returns AnimeScanParseError when last page link has no text content", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a></a></div>`));
    const result = await animeScraper.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("No pagination text");
    }
  });

  it("returns AnimeScanParseError when last page text is not a number", async () => {
    mockFetch(makeHtml(`<div class="page_number"><a>NaN</a></div>`));
    const result = await animeScraper.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result.message).toContain("Invalid page number");
    }
  });

  it("returns AnimeScanHttpError when response is not ok", async () => {
    mockFetch("Error Page", false, 404, "Not Found");
    const result = await animeScraper.getTotalPages();
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect(result).toBeInstanceOf(AnimeScanHttpError);
      expect((result as AnimeScanHttpError).status).toBe(404);
      expect((result as AnimeScanHttpError).html).toBe("Error Page");
    }
  });

  it("bubbles up fetch failure (network error)", async () => {
    const error = new Error("network");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(error));
    await expect(animeScraper.getTotalPages()).rejects.toThrow(error);
  });

  it("bubbles up fetch failure with string", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("network string error"));
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      "network string error",
    );
  });

  it("passes through AnimeScanHttpError from fetchUrl in getTotalPages", async () => {
    const error = new AnimeScanHttpError(
      1,
      AnimeScanStep.GET_TOTAL_PAGES,
      "http://x",
      "fail",
      502,
      undefined,
    );
    vi.spyOn(
      animeScraper as unknown as {
        fetchUrl: (
          url: string,
          page: number,
          scanStep: AnimeScanStep,
        ) => Promise<unknown>;
      },
      "fetchUrl",
    ).mockResolvedValue(error);

    const result = await animeScraper.getTotalPages();
    expect(result).toBe(error);
  });

  it("bubbles up unexpected errors in getTotalPages", async () => {
    mockFetch("Some HTML");
    vi.spyOn(DOMParser.prototype, "parseFromString").mockImplementation(() => {
      throw new Error("unexpected crash");
    });
    await expect(animeScraper.getTotalPages()).rejects.toThrow(
      "unexpected crash",
    );
  });

  it("bubbles up unexpected string errors in getTotalPages", async () => {
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
    expect(result.animeItems).toHaveLength(1);
    expect(result.animeItems[0].title).toBe("Test Anime");
    expect(result.animeItems[0].episodeCount).toBe(12);
    expect(result.animeItems[0].watchCount).toBe(25000);
    expect(result.animeItems[0].uploadDate.getFullYear()).toBe(2024);
  });

  it("collects AnimeScanParseError when title is missing", async () => {
    mockFetch(makeHtml('<a class="theme-list-main" href="/x"></a>'));
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.animeItems).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
    }
  });

  it("collects AnimeScanParseError when title textContent is exactly empty", async () => {
    mockFetch(
      makeHtml(
        '<a class="theme-list-main" href="/x"><p class="theme-name"></p></a>',
      ),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
    }
  });

  it("collects AnimeScanParseError when card has no href", async () => {
    mockFetch(makeHtml('<a class="theme-list-main"></a>'));
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.message).toContain("Missing href");
    }
  });

  it("collects AnimeScanParseError when watch count is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
      </a>
    `),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Watch count element missing");
    }
  });

  it("collects AnimeScanParseError when watch count is NaN", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/animeVideo.php?sn=123">
        <p class="theme-name">Test Anime</p>
        <p>InvalidCount</p>
      </a>
    `),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.animeItems[0].watchCount).toBe(25000);
  });

  it("returns error when fetchUrl fails in scrapeAnimesOnPage", async () => {
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
        ) => Promise<unknown>;
      },
      "fetchUrl",
    ).mockResolvedValue(error);
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.animeItems).toHaveLength(0);
    expect(result.httpErrors).toHaveLength(1);
    expect(result.httpErrors[0]).toBe(error);
  });

  it("collects AnimeScanParseError when episode count parsing fails", async () => {
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Failed to parse episode count");
    }
  });

  it("collects AnimeScanParseError when upload date parsing fails", async () => {
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Failed to parse upload date");
    }
  });

  it("collects AnimeScanParseError when detail block is missing", async () => {
    mockFetch(
      makeHtml(`
      <a class="theme-list-main" href="/x">
        <p class="theme-name">Test</p>
        <p>1,000</p>
      </a>
    `),
    );
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Detail block missing");
    }
  });

  it("collects AnimeScanParseError when episode count element is missing", async () => {
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Episode count missing");
    }
  });

  it("collects AnimeScanParseError when upload date element is missing", async () => {
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
    const result = await animeScraper.scrapeAnimesOnPage(1);
    expect(result.parseErrors).toHaveLength(1);
    const err = result.parseErrors[0];
    if (err instanceof AnimeScanParseError) {
      expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_INFO);
      expect(err.message).toContain("Upload date missing");
    }
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
    expect(isError(result)).toBe(false);
    if (!isError(result)) {
      expect(result.score).toBe(8.5);
      expect(result.ratingCount).toBe(1234);
      expect(result.description).toBe("Great show");
    }
  });

  it("returns AnimeScanParseError when score is missing", async () => {
    mockFetch(makeHtml("<div>No score</div>"));
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(isError(result)).toBe(true);
    if (isError(result)) {
      expect((result as AnimeScanParseError).scanStep).toBe(
        AnimeScanStep.PARSE_ANIME_DETAIL,
      );
    }
  });

  it("returns AnimeScanParseError when score is NaN", async () => {
    mockFetch(makeHtml('<div class="score-overall-number">ABC</div>'));
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(isError(result)).toBe(true);
    const err = result as AnimeScanParseError;
    expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_DETAIL);
    expect(err.message).toContain("Failed to parse score");
  });

  it("returns AnimeScanParseError when rating count is NaN", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">NaN人評價</div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(isError(result)).toBe(true);
    const err = result as AnimeScanParseError;
    expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_DETAIL);
    expect(err.message).toContain("Failed to parse rating count");
  });

  it("returns AnimeScanParseError when rating count element is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="data-intro"><p>Great show</p></div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(isError(result)).toBe(true);
    const err = result as AnimeScanParseError;
    expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_DETAIL);
    expect(err.message).toContain("Rating count element missing");
  });

  it("returns AnimeScanParseError when description is missing", async () => {
    mockFetch(
      makeHtml(
        '<div class="score-overall-number">8.5</div><div class="score-overall-people">1,234人評價</div>',
      ),
    );
    const result = await animeScraper.scrapeAnimeDetails(
      "http://example.com",
      1,
    );
    expect(isError(result)).toBe(true);
    const err = result as AnimeScanParseError;
    expect(err.scanStep).toBe(AnimeScanStep.PARSE_ANIME_DETAIL);
    expect(err.message).toContain("Description missing");
  });

  it("passes through AnimeScanHttpError from fetchUrl in scrapeAnimeDetails", async () => {
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
        ) => Promise<unknown>;
      },
      "fetchUrl",
    ).mockResolvedValue(error);
    const result = await animeScraper.scrapeAnimeDetails("http://x", 1);
    expect(result).toBe(error);
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
  it("scanAllWithPipeline delegates execution to AnimeScanner", async () => {
    const item = { link: "http://a", title: "A" } as AnimeItem;
    vi.spyOn(animeScraper, "scrapeAnimesOnPage").mockResolvedValue({
      animeItems: [item],
      httpErrors: [],
      parseErrors: [],
    });
    vi.spyOn(animeScraper, "scrapeAnimeDetails").mockResolvedValue({
      score: 9.5,
      ratingCount: 500,
      description: "Awesome",
    });

    const animeItems: AnimeItem[] = [];
    const httpErrors: AnimeScanHttpError[] = [];
    const parseErrors: AnimeScanParseError[] = [];

    await new Promise<void>((resolve, reject) => {
      const pipeline = new AnimeScanner(1, 1, 1, () => true, animeScraper);
      pipeline.scan().subscribe({
        next: (event: AnimeScanEvent) => {
          if (event instanceof AnimeScanHttpError) {
            httpErrors.push(event);
          } else if (event instanceof AnimeScanParseError) {
            parseErrors.push(event);
          } else if (!(event instanceof Error)) {
            animeItems.push(event);
          }
        },
        error: reject,
        complete: resolve,
      });
    });

    expect(animeItems).toHaveLength(1);
    expect(animeItems[0].title).toBe("A");
    expect(animeItems[0].score).toBe(9.5);
    expect(httpErrors).toHaveLength(0);
    expect(parseErrors).toHaveLength(0);
  });
});
