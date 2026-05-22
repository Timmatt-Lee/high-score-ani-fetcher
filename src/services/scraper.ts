export interface AnimeItem {
  link: string;
  title: string;
  watch_count: number;
  episode_count: string;
  upload_date: string;
  score: number;
  rating_count: number;
  description: string;
}

const BASE_URL = "https://ani.gamer.com.tw/";

export class ScraperService {
  /**
   * Fetches the total number of pages from the anime list.
   */
  static async getTotalPages(): Promise<number> {
    const url = `${BASE_URL}animeList.php?page=1`;
    let text: string;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      text = await response.text();
    } catch (error) {
      console.error("Failed to fetch total pages:", error);
      throw error;
    }

    const doc = new DOMParser().parseFromString(text, "text/html");
    const pageLinks = doc.querySelectorAll(".page_number a");
    if (pageLinks.length === 0) return 1;

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    return parseInt(lastPageText || "1", 10);
  }

  /**
   * Scrapes basic info for all items on a single page.
   */
  static async scrapeListPage(pageNum: number): Promise<AnimeItem[]> {
    const url = `${BASE_URL}animeList.php?page=${pageNum}`;
    let text: string;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      text = await response.text();
    } catch (error) {
      console.error(`Failed to fetch page ${pageNum}:`, error);
      return [];
    }

    const items: AnimeItem[] = [];
    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    for (const card of Array.from(cards)) {
      const href = card.getAttribute("href");
      if (!href) continue;

      const link = BASE_URL + href.replace(/^\//, "");
      const titleEl = card.querySelector(".theme-name");
      const title = titleEl ? titleEl.textContent?.trim() || "" : "No Title";

      const watchCountEl = card.querySelector("p:not(.theme-time)");
      let watchCount = 0;
      if (watchCountEl && watchCountEl.textContent) {
        const str = watchCountEl.textContent.trim();
        if (str.includes("萬")) {
          watchCount = parseFloat(str.replace("萬", "")) * 10000;
        } else {
          watchCount = parseInt(str.replace(/,/g, ""), 10) || 0;
        }
      }

      let episode_count = "N/A";
      let upload_date = "N/A";
      const detailBlock = card.querySelector(".theme-detail-info-block");
      if (detailBlock) {
        const epEl = detailBlock.querySelector(".theme-number");
        if (epEl)
          episode_count =
            epEl.textContent?.replace("共", "").replace("集", "").trim() ||
            "N/A";

        const timeEl = detailBlock.querySelector(".theme-time");
        if (timeEl)
          upload_date =
            timeEl.textContent?.replace("年份：", "").trim() || "N/A";
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
  static async scrapeAnimeDetails(
    link: string,
  ): Promise<{ score: number; rating_count: number; description: string }> {
    let text: string;
    try {
      const response = await fetch(link);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      text = await response.text();
    } catch (error) {
      console.error(`Failed to fetch details for ${link}:`, error);
      return {
        score: 0,
        rating_count: 0,
        description: "Error fetching details",
      };
    }

    const doc = new DOMParser().parseFromString(text, "text/html");

    const scoreNumDiv = doc.querySelector(".score-overall-number");
    const score =
      scoreNumDiv && scoreNumDiv.textContent
        ? parseFloat(scoreNumDiv.textContent)
        : 0;

    const scorePeopleDiv = doc.querySelector(".score-overall-people");
    let rating_count = 0;
    if (scorePeopleDiv && scorePeopleDiv.textContent) {
      rating_count =
        parseInt(
          scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
          10,
        ) || 0;
    }

    const descDiv = doc.querySelector(".data-intro p");
    const description =
      descDiv && descDiv.textContent
        ? descDiv.textContent.trim().substring(0, 200) + "..."
        : "No description found.";

    return { score, rating_count, description };
  }

  /**
   * Fetch all pages with concurrency control.
   */
  static async fetchAllWithConcurrency(
    totalPages: number,
    concurrency: number,
    onProgress: (percent: number, msg: string) => void,
  ): Promise<AnimeItem[]> {
    const results: AnimeItem[] = [];
    let completed = 0;

    const fetchPage = async (page: number) => {
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

    // Simple concurrency executor
    const runWorker = async () => {
      while (queue.length > 0) {
        const page = queue.shift();
        if (page) await fetchPage(page);
      }
    };

    const workers = Array.from({ length: concurrency }, () => runWorker());
    await Promise.all(workers);

    return results;
  }
}
