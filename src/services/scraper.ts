export interface AnimeItem {
  link: string;
  title: string;
  watch_count: number;
  episode_count: number;
  upload_date: Date;
  score: number;
  rating_count: number;
  description: string;
}

const BASE_URL = "https://ani.gamer.com.tw";

export class ScraperService {
  private async fetchText(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch ${url}: ${response.status} ${response.statusText}`,
      );
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
      throw new Error(
        "Pagination element not found. Page structure might have changed.",
      );
    }

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    if (!lastPageText) {
      throw new Error("Last page link has no text content.");
    }

    const totalPages = parseInt(lastPageText, 10);
    if (isNaN(totalPages)) {
      throw new Error(`Invalid total pages parsed: "${lastPageText}"`);
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
      const title = titleEl?.textContent?.trim() || "";

      const watchCountEl = card.querySelector("p:not(.theme-time)");
      let watchCount = NaN;
      if (watchCountEl && watchCountEl.textContent) {
        const str = watchCountEl.textContent.trim();
        if (str.includes("萬")) {
          watchCount = parseFloat(str.replace("萬", "")) * 10000;
        } else {
          watchCount = parseInt(str.replace(/,/g, ""), 10);
        }
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
  async scrapeAnimeDetails(
    link: string,
  ): Promise<{ score: number; rating_count: number; description: string }> {
    const text = await this.fetchText(link);
    const doc = new DOMParser().parseFromString(text, "text/html");

    const scoreNumDiv = doc.querySelector(".score-overall-number");
    const score =
      scoreNumDiv && scoreNumDiv.textContent
        ? parseFloat(scoreNumDiv.textContent)
        : NaN;

    const scorePeopleDiv = doc.querySelector(".score-overall-people");
    let rating_count = NaN;
    if (scorePeopleDiv && scorePeopleDiv.textContent) {
      rating_count = parseInt(
        scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
        10,
      );
    }

    const descDiv = doc.querySelector(".data-intro p");
    const description =
      descDiv && descDiv.textContent ? descDiv.textContent.trim() : "";

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
