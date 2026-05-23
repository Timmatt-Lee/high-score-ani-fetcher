import {
  type AnimeItem,
  type AnimeDetails,
  type ScrapeListResult,
  type ScanResult,
  type AnimeScraper,
  type ScanProgressCallback,
} from "../types/anime";
import { type Result, type BatchResult } from "../types/result";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
import { ScraperPipeline } from "./scraperPipeline";

const BASE_URL = "https://ani.gamer.com.tw";

export class ScraperService implements AnimeScraper {
  private async fetchText(
    url: string,
  ): Promise<Result<string, ScraperHttpError>> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const snippet = await response
          .text()
          .catch(() => "")
          .then((t) => t.slice(0, 200));
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperHttpError(url, snippet, response.status),
        };
      }
      return {
        isSuccess: true,
        items: await response.text(),
        error: undefined,
      };
    } catch (err) {
      return {
        isSuccess: false,
        items: undefined,
        error: new ScraperHttpError(
          url,
          err instanceof Error ? err.message : String(err),
          500,
        ),
      };
    }
  }

  /**
   * Fetches the total number of pages from the anime list.
   */
  async getTotalPages(): Promise<
    Result<number, ScraperHttpError | ScraperParseError>
  > {
    const url = `${BASE_URL}/animeList.php?page=1`;

    const textResult = await this.fetchText(url);
    if (!textResult.isSuccess) return textResult;
    const text = textResult.items;

    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const pageLinks = doc.querySelectorAll(".page_number a");

      if (pageLinks.length === 0) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.body.innerHTML.substring(0, 500),
            "Pagination element not found",
          ),
        };
      }

      const lastPageText = pageLinks[pageLinks.length - 1].textContent;
      if (!lastPageText) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.querySelector(".page_number")!.outerHTML,
            "No pagination text",
          ),
        };
      }

      const totalPages = parseInt(lastPageText, 10);
      if (isNaN(totalPages)) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.querySelector(".page_number")!.outerHTML,
            "Invalid page number",
          ),
        };
      }

      return { isSuccess: true, items: totalPages, error: undefined };
    } catch (err) {
      if (err instanceof ScraperParseError) {
        return { isSuccess: false, items: undefined, error: err };
      }
      return {
        isSuccess: false,
        items: undefined,
        error: new ScraperParseError(
          ScraperErrorSource.PAGINATION,
          url,
          err instanceof Error ? err.message : String(err),
        ),
      };
    }
  }

  /**
   * Parses a single anime card element into an AnimeItem.
   */
  private parseAnimeCard(
    card: Element,
    url: string,
  ): Result<AnimeItem, ScraperParseError> {
    try {
      const href = card.getAttribute("href");
      if (!href) {
        // Skip silently as it might be a decorative anchor or non-anime link
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.TITLE,
            url,
            "Missing href",
            "SKIPPED",
          ),
        };
      }

      const link = `${BASE_URL}/${href.replace(/^\//, "")}`;
      const titleEl = card.querySelector(".theme-name");
      if (!titleEl || !titleEl.textContent?.trim()) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.TITLE,
            url,
            card.outerHTML.substring(0, 500),
            "Anime title missing",
          ),
        };
      }
      const title = titleEl.textContent.trim();

      const watchCountEl = card.querySelector(
        "p:not(.theme-name):not(.theme-time)",
      );
      if (!watchCountEl || !watchCountEl.textContent) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.WATCH_COUNT,
            url,
            card.outerHTML.substring(0, 500),
            "Watch count element missing",
          ),
        };
      }

      const str = watchCountEl.textContent.trim();
      const watchCount = str.includes("萬")
        ? Math.floor(parseFloat(str.replace("萬", "")) * 10000)
        : parseInt(str.replace(/,/g, ""), 10);

      if (isNaN(watchCount)) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.WATCH_COUNT,
            url,
            card.outerHTML.substring(0, 500),
            "Failed to parse watch count",
          ),
        };
      }

      const detailBlock = card.querySelector(".theme-detail-info-block");
      if (!detailBlock) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.EPISODE_COUNT,
            url,
            card.outerHTML.substring(0, 500),
            "Detail block missing",
          ),
        };
      }

      const epEl = detailBlock.querySelector(".theme-number");
      if (!epEl || !epEl.textContent) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.EPISODE_COUNT,
            url,
            detailBlock.outerHTML,
            "Episode count missing",
          ),
        };
      }
      const episodeCount = parseInt(
        epEl.textContent.replace("共", "").replace("集", "").trim(),
        10,
      );

      const timeEl = detailBlock.querySelector(".theme-time");
      if (!timeEl || !timeEl.textContent) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.UPLOAD_DATE,
            url,
            detailBlock.outerHTML,
            "Upload date missing",
          ),
        };
      }
      const yearStr = timeEl.textContent.replace("年份：", "").trim();
      const uploadDate = new Date(`${yearStr}-01-01T00:00:00Z`);

      if (isNaN(episodeCount)) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.EPISODE_COUNT,
            url,
            epEl.outerHTML,
            "Failed to parse episode count",
          ),
        };
      }
      if (isNaN(uploadDate.getTime())) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.UPLOAD_DATE,
            url,
            timeEl.outerHTML,
            "Failed to parse upload date",
          ),
        };
      }

      return {
        isSuccess: true,
        items: {
          link,
          title,
          watchCount,
          episodeCount,
          uploadDate,
          score: 0,
          ratingCount: 0,
          description: "",
        },
        error: undefined,
      };
    } catch (err) {
      return {
        isSuccess: false,
        items: undefined,
        error: new ScraperParseError(
          ScraperErrorSource.TITLE,
          url,
          err instanceof Error ? err.message : String(err),
          "Unexpected parsing error",
        ),
      };
    }
  }

  /**
   * Scrapes basic info for all items on a single page.
   */
  async scrapeListPage(pageNum: number): Promise<ScrapeListResult> {
    const url = `${BASE_URL}/animeList.php?page=${pageNum}`;
    const items: AnimeItem[] = [];
    const errors: (ScraperParseError | ScraperHttpError)[] = [];

    const textResult = await this.fetchText(url);
    if (!textResult.isSuccess) return { items: [], errors: [textResult.error] };

    const text = textResult.items;
    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    for (const card of Array.from(cards)) {
      const parseRes = this.parseAnimeCard(card, url);
      if (parseRes.isSuccess) {
        items.push(parseRes.items);
      } else if (parseRes.error.message !== "SKIPPED") {
        errors.push(parseRes.error);
      }
    }

    return { items, errors };
  }

  /**
   * Scrapes details for a single anime item.
   */
  async scrapeAnimeDetails(
    link: string,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>> {
    const textResult = await this.fetchText(link);
    if (!textResult.isSuccess) return textResult;
    const text = textResult.items;

    try {
      const doc = new DOMParser().parseFromString(text, "text/html");

      const scoreNumDiv = doc.querySelector(".score-overall-number");
      if (!scoreNumDiv || !scoreNumDiv.textContent) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.SCORE,
            link,
            doc.body.innerHTML.substring(0, 200),
            "Score element missing",
          ),
        };
      }
      const score = parseFloat(scoreNumDiv.textContent);
      if (isNaN(score)) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.SCORE,
            link,
            scoreNumDiv.outerHTML,
            "Failed to parse score",
          ),
        };
      }

      const scorePeopleDiv = doc.querySelector(".score-overall-people");
      if (!scorePeopleDiv || !scorePeopleDiv.textContent) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.RATING_COUNT,
            link,
            doc.body.innerHTML.substring(0, 200),
            "Rating count element missing",
          ),
        };
      }
      const ratingCount = parseInt(
        scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
        10,
      );
      if (isNaN(ratingCount)) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.RATING_COUNT,
            link,
            scorePeopleDiv.outerHTML,
            "Failed to parse rating count",
          ),
        };
      }

      const descDiv = doc.querySelector(".data-intro p");
      if (!descDiv || !descDiv.textContent?.trim()) {
        return {
          isSuccess: false,
          items: undefined,
          error: new ScraperParseError(
            ScraperErrorSource.DESCRIPTION,
            link,
            doc.body.innerHTML.substring(0, 200),
            "Description missing",
          ),
        };
      }
      const description = descDiv.textContent.trim();

      return {
        isSuccess: true,
        items: { score, ratingCount, description },
        error: undefined,
      };
    } catch (err) {
      if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
        return { isSuccess: false, items: undefined, error: err };
      }
      return {
        isSuccess: false,
        items: undefined,
        error: new ScraperParseError(
          ScraperErrorSource.DESCRIPTION,
          link,
          err instanceof Error ? err.message : String(err),
          "Unexpected parsing error",
        ),
      };
    }
  }

  /**
   * Fetches details for multiple anime items concurrently with concurrency control.
   */
  async fetchDetailsWithConcurrency(
    items: AnimeItem[],
    concurrency: number,
    onProgress: (
      completed: number,
      total: number,
      currentTitle: string,
    ) => void,
  ): Promise<BatchResult<AnimeItem, ScraperHttpError | ScraperParseError>> {
    const results: (AnimeItem | null)[] = new Array(items.length).fill(null);
    const errors: (ScraperHttpError | ScraperParseError)[] = [];
    let completedCount = 0;
    const totalCount = items.length;

    if (totalCount === 0) {
      return { items: [], errors: [] };
    }

    const queue = items.map((item, index) => ({ item, index }));

    const fetchDetailsAction = async (item: AnimeItem, index: number) => {
      onProgress(completedCount, totalCount, item.title);
      try {
        const detailsResult = await this.scrapeAnimeDetails(item.link);
        if (detailsResult.isSuccess) {
          results[index] = { ...item, ...detailsResult.items };
        } else {
          errors.push(detailsResult.error);
        }
      } catch (err) {
        if (
          err instanceof ScraperHttpError ||
          err instanceof ScraperParseError
        ) {
          errors.push(err);
        } else {
          errors.push(
            new ScraperHttpError(
              item.link,
              err instanceof Error ? err.message : String(err),
              500,
            ),
          );
        }
      }
      completedCount++;
      onProgress(completedCount, totalCount, item.title);
    };

    const runWorker = async () => {
      while (true) {
        const task = queue.shift();
        if (task === undefined) break;
        await fetchDetailsAction(task.item, task.index);
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrency, totalCount) },
      () => runWorker(),
    );
    await Promise.all(workers);

    const successfulItems = results.filter(
      (item): item is AnimeItem => item !== null,
    );

    return { items: successfulItems, errors };
  }

  /**
   * Fetch all pages with concurrency control.
   */
  async fetchAllWithConcurrency(
    totalPages: number,
    concurrency: number,
    onProgress: (percent: number, msg: string) => void,
  ): Promise<BatchResult<AnimeItem, ScraperHttpError | ScraperParseError>> {
    const results: AnimeItem[][] = Array.from({ length: totalPages }, () => []);
    const errors: (ScraperHttpError | ScraperParseError)[] = [];
    let completed = 0;

    const fetchPageAction = async (page: number) => {
      onProgress(
        Math.floor((completed / totalPages) * 100),
        `Fetching page ${page}...`,
      );
      try {
        const pageResult = await this.scrapeListPage(page);
        results[page - 1] = pageResult.items;
        errors.push(...pageResult.errors);
      } catch (err) {
        if (
          err instanceof ScraperHttpError ||
          err instanceof ScraperParseError
        ) {
          errors.push(err);
        } else {
          errors.push(
            new ScraperHttpError(
              `${BASE_URL}/animeList.php?page=${page}`,
              err instanceof Error ? err.message : String(err),
              500,
            ),
          );
        }
      }
      completed++;
      onProgress(
        Math.floor((completed / totalPages) * 100),
        `Completed page ${page}`,
      );
    };

    const queue = Array.from({ length: totalPages }, (_, i) => i + 1);

    const runWorker = async () => {
      while (true) {
        const page = queue.shift();
        if (page === undefined) break;
        await fetchPageAction(page);
      }
    };

    const workers = Array.from({ length: concurrency }, () => runWorker());
    await Promise.all(workers);

    return { items: results.flat(), errors };
  }

  /**
   * Pipeline scraping where stage 1 page fetching feeds items dynamically to stage 2 details fetching.
   */
  async scanAllWithPipeline(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    onProgress: ScanProgressCallback,
  ): Promise<ScanResult> {
    const pipeline = new ScraperPipeline(
      totalPages,
      pageConcurrency,
      detailConcurrency,
      filterItem,
      onProgress,
      this,
    );
    return pipeline.execute();
  }
}

export const scraperService = new ScraperService();
