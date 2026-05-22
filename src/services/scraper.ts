import {
  type AnimeItem,
  type AnimeDetails,
  type ScrapeListResult,
  type ScanResult,
} from "../types/anime";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../errors";
import { ScraperPipeline } from "./scraperPipeline";

const BASE_URL = "https://ani.gamer.com.tw";

export class ScraperService {
  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      const snippet = await response
        .text()
        .catch(() => "")
        .then((t) => t.slice(0, 200));
      throw new ScraperHttpError(url, snippet, response.status);
    }
    return response.text();
  }

  /**
   * Fetches the total number of pages from the anime list.
   */
  async getTotalPages(): Promise<number> {
    const url = `${BASE_URL}/animeList.php?page=1`;
    const text = await this.fetchText(url);

    const doc = new DOMParser().parseFromString(text, "text/html");
    const pageLinks = doc.querySelectorAll(".page_number a");

    if (pageLinks.length === 0) {
      throw new ScraperParseError(
        ScraperErrorSource.PAGINATION,
        url,
        doc.body.innerHTML.substring(0, 500),
      );
    }

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    if (!lastPageText) {
      throw new ScraperParseError(
        ScraperErrorSource.PAGINATION,
        url,
        doc.querySelector(".page_number")!.outerHTML,
      );
    }

    const totalPages = parseInt(lastPageText, 10);
    if (isNaN(totalPages)) {
      throw new ScraperParseError(
        ScraperErrorSource.PAGINATION,
        url,
        doc.querySelector(".page_number")!.outerHTML,
      );
    }

    return totalPages;
  }

  /**
   * Parses a single anime card element into an AnimeItem.
   * Throws ScraperParseError if parsing of required fields fails.
   */
  private parseAnimeCard(card: Element, url: string): AnimeItem {
    const href = card.getAttribute("href");
    if (!href) {
      throw new ScraperParseError(
        ScraperErrorSource.TITLE,
        url,
        card.outerHTML.substring(0, 500),
      );
    }

    const link = `${BASE_URL}/${href.replace(/^\//, "")}`;
    const titleEl = card.querySelector(".theme-name");
    if (!titleEl || !titleEl.textContent?.trim()) {
      throw new ScraperParseError(
        ScraperErrorSource.TITLE,
        url,
        card.outerHTML.substring(0, 500),
      );
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
      throw new ScraperParseError(
        ScraperErrorSource.WATCH_COUNT,
        url,
        card.outerHTML.substring(0, 500),
      );
    }

    let episode_count = NaN;
    let upload_date = new Date(NaN);

    const detailBlock = card.querySelector(".theme-detail-info-block");
    if (detailBlock) {
      const epEl = detailBlock.querySelector(".theme-number");
      if (epEl && epEl.textContent) {
        episode_count = parseInt(
          epEl.textContent.replace("共", "").replace("集", "").trim(),
          10,
        );
      }

      const timeEl = detailBlock.querySelector(".theme-time");
      if (timeEl && timeEl.textContent) {
        const yearStr = timeEl.textContent.replace("年份：", "").trim();
        upload_date = new Date(`${yearStr}-01-01T00:00:00Z`);
      }
    }

    if (isNaN(episode_count)) {
      throw new ScraperParseError(
        ScraperErrorSource.EPISODE_COUNT,
        url,
        card.outerHTML.substring(0, 500),
      );
    }
    if (isNaN(upload_date.getTime())) {
      throw new ScraperParseError(
        ScraperErrorSource.UPLOAD_DATE,
        url,
        card.outerHTML.substring(0, 500),
      );
    }

    return {
      link,
      title,
      watch_count: watchCount,
      episode_count,
      upload_date,
      score: 0,
      rating_count: 0,
      description: "",
    };
  }

  /**
   * Scrapes basic info for all items on a single page.
   */
  async scrapeListPage(pageNum: number): Promise<ScrapeListResult> {
    const url = `${BASE_URL}/animeList.php?page=${pageNum}`;
    const text = await this.fetchText(url);

    const items: AnimeItem[] = [];
    const errors: ScraperParseError[] = [];
    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    for (const card of Array.from(cards)) {
      try {
        const item = this.parseAnimeCard(card, url);
        items.push(item);
      } catch (error) {
        if (error instanceof ScraperParseError) {
          errors.push(error);
        } else {
          errors.push(
            new ScraperParseError(
              ScraperErrorSource.TITLE,
              url,
              card.outerHTML.substring(0, 500),
            ),
          );
        }
      }
    }

    return { items, errors };
  }

  /**
   * Scrapes details for a single anime item.
   */
  async scrapeAnimeDetails(link: string): Promise<AnimeDetails> {
    const text = await this.fetchText(link);
    const doc = new DOMParser().parseFromString(text, "text/html");

    const scoreNumDiv = doc.querySelector(".score-overall-number");
    if (!scoreNumDiv || !scoreNumDiv.textContent) {
      throw new ScraperParseError(
        ScraperErrorSource.SCORE,
        link,
        doc.body.innerHTML.substring(0, 500),
      );
    }
    const score = parseFloat(scoreNumDiv.textContent);
    if (isNaN(score)) {
      throw new ScraperParseError(
        ScraperErrorSource.SCORE,
        link,
        scoreNumDiv.outerHTML,
      );
    }

    const scorePeopleDiv = doc.querySelector(".score-overall-people");
    if (!scorePeopleDiv || !scorePeopleDiv.textContent) {
      throw new ScraperParseError(
        ScraperErrorSource.RATING_COUNT,
        link,
        doc.body.innerHTML.substring(0, 500),
      );
    }
    const rating_count = parseInt(
      scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
      10,
    );
    if (isNaN(rating_count)) {
      throw new ScraperParseError(
        ScraperErrorSource.RATING_COUNT,
        link,
        scorePeopleDiv.outerHTML,
      );
    }

    const descDiv = doc.querySelector(".data-intro p");
    if (!descDiv || !descDiv.textContent?.trim()) {
      throw new ScraperParseError(
        ScraperErrorSource.DESCRIPTION,
        link,
        doc.body.innerHTML.substring(0, 500),
      );
    }
    const description = descDiv.textContent.trim();

    return { score, rating_count, description };
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
  ): Promise<{
    items: AnimeItem[];
    errors: (ScraperHttpError | ScraperParseError)[];
  }> {
    const results: (AnimeItem | null)[] = new Array(items.length).fill(null);
    const errors: (ScraperHttpError | ScraperParseError)[] = [];
    let completed = 0;
    const total = items.length;

    if (total === 0) {
      return { items: [], errors: [] };
    }

    const queue = items.map((item, index) => ({ item, index }));

    const fetchDetailsAction = async (item: AnimeItem, index: number) => {
      onProgress(completed, total, item.title);
      try {
        const details = await this.scrapeAnimeDetails(item.link);
        results[index] = { ...item, ...details };
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
      completed++;
      onProgress(completed, total, item.title);
    };

    const runWorker = async () => {
      while (true) {
        const task = queue.shift();
        if (task === undefined) break;
        await fetchDetailsAction(task.item, task.index);
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
      runWorker(),
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
  ): Promise<ScanResult> {
    const results: AnimeItem[][] = Array.from({ length: totalPages }, () => []);
    const httpErrors: ScraperHttpError[] = [];
    const parseErrors: ScraperParseError[] = [];
    let completed = 0;

    const fetchPageAction = async (page: number) => {
      onProgress(
        Math.floor((completed / totalPages) * 100),
        `Fetching page ${page}...`,
      );
      try {
        const { items, errors: pageErrors } = await this.scrapeListPage(page);
        results[page - 1] = items;
        parseErrors.push(...pageErrors);
      } catch (err) {
        if (err instanceof ScraperHttpError) {
          httpErrors.push(err);
        } else if (err instanceof ScraperParseError) {
          parseErrors.push(err);
        } else {
          httpErrors.push(
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

    return { items: results.flat(), httpErrors, parseErrors };
  }

  /**
   * Pipeline scraping where stage 1 page fetching feeds items dynamically to stage 2 details fetching.
   */
  async scanAllWithPipeline(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    onProgress: (
      pagesCompleted: number,
      pagesTotal: number,
      detailsCompleted: number,
      detailsTotal: number,
      currentTitle: string,
    ) => void,
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
