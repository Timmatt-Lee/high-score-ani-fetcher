import { type AnimeItem, type AnimeDetails } from "../types/anime";
import {
  ScraperErrorSource,
  ScraperHttpError,
  ScraperParseError,
} from "../types/errors";

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
   * Scrapes basic info for all items on a single page.
   */
  async scrapeListPage(pageNum: number): Promise<AnimeItem[]> {
    const url = `${BASE_URL}/animeList.php?page=${pageNum}`;
    const text = await this.fetchText(url);

    const items: AnimeItem[] = [];
    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    for (const card of Array.from(cards)) {
      const href = card.getAttribute("href");
      if (!href) continue;

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
          // parseFloat is necessary for "2.5萬" -> 25000.
          // We wrap in Math.floor to ensure we return an integer.
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

      items.push({
        link,
        title,
        watch_count: watchCount,
        episode_count,
        upload_date,
        score: 0,
        rating_count: 0,
        description: "",
      });
    }

    return items;
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
   * Fetch all pages with concurrency control.
   */
  async fetchAllWithConcurrency(
    totalPages: number,
    concurrency: number,
    onProgress: (percent: number, msg: string) => void,
  ): Promise<AnimeItem[]> {
    const results: AnimeItem[] = [];
    let completed = 0;

    const fetchPageAction = async (page: number) => {
      onProgress(
        Math.floor((completed / totalPages) * 100),
        `Fetching page ${page}...`,
      );
      const items = await this.scrapeListPage(page);
      results.push(...items);
      completed++;
      onProgress(
        Math.floor((completed / totalPages) * 100),
        `Completed page ${page}`,
      );
    };

    const queue = Array.from({ length: totalPages }, (_, i) => i + 1);

    const runWorker = async () => {
      while (queue.length > 0) {
        const page = queue.shift();
        if (page !== undefined) await fetchPageAction(page);
      }
    };

    const workers = Array.from({ length: concurrency }, () => runWorker());
    await Promise.all(workers);

    return results;
  }
}

export const scraperService = new ScraperService();
