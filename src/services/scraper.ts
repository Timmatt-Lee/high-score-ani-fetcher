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
          items: null,
          error: new ScraperHttpError(url, snippet, response.status),
        };
      }
      return { isSuccess: true, items: await response.text(), error: null };
    } catch (err) {
      return {
        isSuccess: false,
        items: null,
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
    let text: string;
    try {
      const textResult = await this.fetchText(url);
      if (!textResult.isSuccess) {
        return textResult;
      }
      text = textResult.items;
    } catch (err) {
      if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
        return { isSuccess: false, items: null, error: err };
      }
      return {
        isSuccess: false,
        items: null,
        error: new ScraperHttpError(
          url,
          err instanceof Error ? err.message : String(err),
          500,
        ),
      };
    }

    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const pageLinks = doc.querySelectorAll(".page_number a");

      if (pageLinks.length === 0) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.body.innerHTML.substring(0, 500),
          ),
        };
      }

      const lastPageText = pageLinks[pageLinks.length - 1].textContent;
      if (!lastPageText) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.querySelector(".page_number")!.outerHTML,
          ),
        };
      }

      const totalPages = parseInt(lastPageText, 10);
      if (isNaN(totalPages)) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.PAGINATION,
            url,
            doc.querySelector(".page_number")!.outerHTML,
          ),
        };
      }

      return { isSuccess: true, items: totalPages, error: null };
    } catch (err) {
      if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
        return { isSuccess: false, items: null, error: err };
      }
      return {
        isSuccess: false,
        items: null,
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
    const href = card.getAttribute("href");
    if (!href) {
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.TITLE,
          url,
          card.outerHTML.substring(0, 500),
        ),
      };
    }

    const link = `${BASE_URL}/${href.replace(/^\//, "")}`;
    const titleEl = card.querySelector(".theme-name");
    if (!titleEl || !titleEl.textContent?.trim()) {
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.TITLE,
          url,
          card.outerHTML.substring(0, 500),
        ),
      };
    }
    const title = titleEl.textContent.trim();

    const watchCountEl = card.querySelector(
      "p:not(.theme-name):not(.theme-time)",
    );
    let watchCount = NaN;
    if (watchCountEl && watchCountEl.textContent) {
      const str = watchCountEl.textContent.trim();
      if (str.includes("萬")) {
        watchCount = Math.floor(parseFloat(str.replace("萬", "")) * 10000);
      } else {
        watchCount = parseInt(str.replace(/,/g, ""), 10);
      }
    }

    if (isNaN(watchCount)) {
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.WATCH_COUNT,
          url,
          card.outerHTML.substring(0, 500),
        ),
      };
    }

    let episodeCount = NaN;
    let uploadDate = new Date(NaN);

    const detailBlock = card.querySelector(".theme-detail-info-block");
    if (detailBlock) {
      const epEl = detailBlock.querySelector(".theme-number");
      if (epEl && epEl.textContent) {
        episodeCount = parseInt(
          epEl.textContent.replace("共", "").replace("集", "").trim(),
          10,
        );
      }

      const timeEl = detailBlock.querySelector(".theme-time");
      if (timeEl && timeEl.textContent) {
        const yearStr = timeEl.textContent.replace("年份：", "").trim();
        uploadDate = new Date(`${yearStr}-01-01T00:00:00Z`);
      }
    }

    if (isNaN(episodeCount)) {
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.EPISODE_COUNT,
          url,
          card.outerHTML.substring(0, 500),
        ),
      };
    }
    if (isNaN(uploadDate.getTime())) {
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.UPLOAD_DATE,
          url,
          card.outerHTML.substring(0, 500),
        ),
      };
    }

    return {
      isSuccess: true,
      items: {
        link,
        title,
        watchCount: watchCount,
        episodeCount,
        uploadDate,
        score: 0,
        ratingCount: 0,
        description: "",
      },
      error: null,
    };
  }

  /**
   * Scrapes basic info for all items on a single page.
   */
  async scrapeListPage(pageNum: number): Promise<ScrapeListResult> {
    const url = `${BASE_URL}/animeList.php?page=${pageNum}`;
    const items: AnimeItem[] = [];
    const errors: (ScraperParseError | ScraperHttpError)[] = [];

    let text: string;
    try {
      const textResult = await this.fetchText(url);
      if (!textResult.isSuccess) {
        return { items: [], errors: [textResult.error] };
      }
      text = textResult.items;
    } catch (error) {
      if (
        error instanceof ScraperHttpError ||
        error instanceof ScraperParseError
      ) {
        return { items: [], errors: [error] };
      }
      return {
        items: [],
        errors: [
          new ScraperHttpError(
            url,
            error instanceof Error ? error.message : String(error),
            500,
          ),
        ],
      };
    }

    try {
      const doc = new DOMParser().parseFromString(text, "text/html");
      const cards = doc.querySelectorAll("a.theme-list-main");

      for (const card of Array.from(cards)) {
        const parseRes = this.parseAnimeCard(card, url);
        if (parseRes.isSuccess) {
          items.push(parseRes.items);
        } else {
          errors.push(parseRes.error);
        }
      }
    } catch (error) {
      if (error instanceof ScraperParseError) {
        errors.push(error);
      } else {
        errors.push(
          new ScraperParseError(
            ScraperErrorSource.TITLE,
            url,
            error instanceof Error ? error.message : String(error),
          ),
        );
      }
    }

    return { items: items, errors };
  }

  /**
   * Scrapes details for a single anime item.
   */
  async scrapeAnimeDetails(
    link: string,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>> {
    let text: string;
    try {
      const textResult = await this.fetchText(link);
      if (!textResult.isSuccess) {
        return textResult;
      }
      text = textResult.items;
    } catch (err) {
      if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
        return { isSuccess: false, items: null, error: err };
      }
      return {
        isSuccess: false,
        items: null,
        error: new ScraperHttpError(
          link,
          err instanceof Error ? err.message : String(err),
          500,
        ),
      };
    }

    try {
      const doc = new DOMParser().parseFromString(text, "text/html");

      const scoreNumDiv = doc.querySelector(".score-overall-number");
      if (!scoreNumDiv || !scoreNumDiv.textContent) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.SCORE,
            link,
            doc.body.innerHTML.substring(0, 500),
          ),
        };
      }
      const score = parseFloat(scoreNumDiv.textContent);
      if (isNaN(score)) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.SCORE,
            link,
            scoreNumDiv.outerHTML,
          ),
        };
      }

      const scorePeopleDiv = doc.querySelector(".score-overall-people");
      if (!scorePeopleDiv || !scorePeopleDiv.textContent) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.RATING_COUNT,
            link,
            doc.body.innerHTML.substring(0, 500),
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
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.RATING_COUNT,
            link,
            scorePeopleDiv.outerHTML,
          ),
        };
      }

      const descDiv = doc.querySelector(".data-intro p");
      if (!descDiv || !descDiv.textContent?.trim()) {
        return {
          isSuccess: false,
          items: null,
          error: new ScraperParseError(
            ScraperErrorSource.DESCRIPTION,
            link,
            doc.body.innerHTML.substring(0, 500),
          ),
        };
      }
      const description = descDiv.textContent.trim();

      return {
        isSuccess: true,
        items: { score, ratingCount, description },
        error: null,
      };
    } catch (err) {
      if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
        return { isSuccess: false, items: null, error: err };
      }
      return {
        isSuccess: false,
        items: null,
        error: new ScraperParseError(
          ScraperErrorSource.DESCRIPTION,
          link,
          err instanceof Error ? err.message : String(err),
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
      const pageResult = await this.scrapeListPage(page);
      results[page - 1] = pageResult.items;
      errors.push(...pageResult.errors);
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
