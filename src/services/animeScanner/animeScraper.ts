import { type Result, isError } from "../../types/result";
import { AnimeScanStep } from "./animeScanStep";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanError,
} from "./animeScanError";
import { type AnimeItem, type AnimeDetails } from "./types";

const BASE_URL = "https://ani.gamer.com.tw";

export class AnimeScraper {
  async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchUrl(
    url: string,
    page: number,
    scanStep: AnimeScanStep,
    animeName?: string,
  ): Promise<Result<string, AnimeScanHttpError>> {
    // Space out requests randomly between 800ms and 1500ms to respect rate limits
    const delayMs = Math.floor(Math.random() * 700) + 800;
    await this.delay(delayMs);

    let response: Response;
    try {
      response = await fetch(url, {
        credentials: "include",
        headers: {
          Referer: "https://ani.gamer.com.tw/",
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return new AnimeScanHttpError(
        page,
        scanStep,
        url,
        errorMsg,
        0, // Status code 0 indicates a network/fetch exception
        animeName,
      );
    }

    if (!response.ok) {
      let snippet = "";
      try {
        const t = await response.text();
        snippet = t.slice(0, 200);
      } catch {
        // Swallowing the error is safe and intentional here because extracting the response body snippet
        // is best-effort; failing to read the text should not prevent reporting the primary HTTP error.
      }
      return new AnimeScanHttpError(
        page,
        scanStep,
        url,
        snippet,
        response.status,
        animeName,
      );
    }
    return await response.text();
  }

  /**
   * Fetches the total number of pages from the anime list.
   */
  async getTotalPages(): Promise<Result<number, AnimeScanError>> {
    const url = `${BASE_URL}/animeList.php?page=1`;

    const text = await this.fetchUrl(url, 1, AnimeScanStep.GET_TOTAL_PAGES);
    if (isError(text)) return text;

    const doc = new DOMParser().parseFromString(text, "text/html");
    const pageLinks = doc.querySelectorAll(".page_number a");
    if (pageLinks.length === 0) {
      return new AnimeScanParseError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        url,
        doc.body.innerHTML.substring(0, 500),
        "Pagination element not found",
      );
    }

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    if (!lastPageText) {
      return new AnimeScanParseError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        url,
        doc.body.innerHTML.substring(0, 500),
        "No pagination text",
      );
    }

    const totalPages = parseInt(lastPageText, 10);
    if (isNaN(totalPages)) {
      return new AnimeScanParseError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        url,
        doc.body.innerHTML.substring(0, 500),
        "Invalid page number",
      );
    }

    return totalPages;
  }

  /**
   * Parses a single anime card element into an AnimeItem.
   */
  private parseAnimeCard(
    card: Element,
    url: string,
    page: number,
  ): Result<AnimeItem, AnimeScanParseError> {
    const href = card.getAttribute("href");
    if (!href) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Missing href",
      );
    }

    const link = `${BASE_URL}/${href.replace(/^\//, "")}`;
    const titleEl = card.querySelector(".theme-name");
    let title = "";
    if (titleEl) {
      const text = titleEl.textContent;
      if (text) {
        title = text.trim();
      }
    }

    if (!title) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Anime title missing",
      );
    }

    const watchCountEl = card.querySelector(
      "p:not(.theme-name):not(.theme-time)",
    );
    if (!watchCountEl || !watchCountEl.textContent) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Watch count element missing",
      );
    }

    const str = watchCountEl.textContent.trim();
    const watchCount = str.includes("萬")
      ? Math.floor(parseFloat(str.replace("萬", "")) * 10000)
      : parseInt(str.replace(/,/g, ""), 10);

    if (isNaN(watchCount)) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Failed to parse watch count",
      );
    }

    const detailBlock = card.querySelector(".theme-detail-info-block");
    if (!detailBlock) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Detail block missing",
      );
    }

    const epEl = detailBlock.querySelector(".theme-number");

    if (!epEl || !epEl.textContent) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        detailBlock.outerHTML,
        "Episode count missing",
      );
    }

    const timeEl = detailBlock.querySelector(".theme-time");
    if (!timeEl || !timeEl.textContent) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        detailBlock.outerHTML,
        "Upload date missing",
      );
    }

    const episodeCount = parseInt(
      epEl.textContent.replace("共", "").replace("集", "").trim(),
      10,
    );

    if (isNaN(episodeCount)) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        epEl.outerHTML,
        "Failed to parse episode count",
      );
    }

    const yearStr = timeEl.textContent.replace("年份：", "").trim();
    const uploadDate = new Date(`${yearStr}-01-01T00:00:00Z`);
    if (isNaN(uploadDate.getTime())) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        timeEl.outerHTML,
        "Failed to parse upload date",
      );
    }

    return {
      link,
      title,
      watchCount,
      episodeCount,
      uploadDate,
      score: 0,
      ratingCount: 0,
      description: "",
    };
  }

  /**
   * Scrapes basic info for all items on a single page.
   */
  async scrapeAnimesOnPage(page: number): Promise<{
    animeItems: AnimeItem[];
    httpErrors: AnimeScanHttpError[];
    parseErrors: AnimeScanParseError[];
  }> {
    const url = `${BASE_URL}/animeList.php?page=${page}`;
    const text = await this.fetchUrl(url, page, AnimeScanStep.SCRAPE_LIST_PAGE);
    if (isError(text)) {
      return {
        animeItems: [],
        httpErrors: [text],
        parseErrors: [],
      };
    }

    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    const animeItems: AnimeItem[] = [];
    const httpErrors: AnimeScanHttpError[] = [];
    const parseErrors: AnimeScanParseError[] = [];

    for (const card of Array.from(cards)) {
      const res = this.parseAnimeCard(card, url, page);
      if (isError(res)) {
        parseErrors.push(res);
      } else {
        animeItems.push(res);
      }
    }

    return { animeItems, httpErrors, parseErrors };
  }

  /**
   * Scrapes details for a single anime item.
   */
  async scrapeAnimeDetails(
    link: string,
    page: number,
    animeName?: string,
  ): Promise<Result<AnimeDetails, AnimeScanError>> {
    const text = await this.fetchUrl(
      link,
      page,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      animeName,
    );
    if (isError(text)) return text;

    const doc = new DOMParser().parseFromString(text, "text/html");
    const scoreNumDiv = doc.querySelector(".score-overall-number");
    if (!scoreNumDiv || !scoreNumDiv.textContent) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Score element missing",
        animeName,
      );
    }
    const score = parseFloat(scoreNumDiv.textContent);
    if (isNaN(score)) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        link,
        scoreNumDiv.outerHTML,
        "Failed to parse score",
        animeName,
      );
    }

    const scorePeopleDiv = doc.querySelector(".score-overall-people");
    if (!scorePeopleDiv || !scorePeopleDiv.textContent) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Rating count element missing",
        animeName,
      );
    }
    const ratingCount = parseInt(
      scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
      10,
    );
    if (isNaN(ratingCount)) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        link,
        scorePeopleDiv.outerHTML,
        "Failed to parse rating count",
        animeName,
      );
    }

    const descDiv = doc.querySelector(".data-intro p");
    if (!descDiv || !descDiv.textContent?.trim()) {
      return new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_DETAIL,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Description missing",
        animeName,
      );
    }
    const description = descDiv.textContent.trim();

    return { score, ratingCount, description };
  }
}

export const animeScraper = new AnimeScraper();
