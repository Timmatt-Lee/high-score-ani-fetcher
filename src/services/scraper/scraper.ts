import {
  type AnimeItem,
  type AnimeDetails,
  type ScraperResult,
  type AnimeScraper,
  type ScanEvent,
  type PipelineOptions,
} from "../../types/anime";
import { type Result, isError } from "../../types/result";
import { ScraperScanStep } from "./scraper-scan-step";
import { ScraperHttpError, ScraperParseError } from "./scraper-error";
import { ScraperPipeline } from "./scraperPipeline";
import { type Observable } from "rxjs";

const BASE_URL = "https://ani.gamer.com.tw";

export class ScraperService implements AnimeScraper {
  private async fetchText(
    url: string,
    page = 1,
    scanStep = ScraperScanStep.PAGINATION,
  ): Promise<Result<string, ScraperHttpError>> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        let snippet = "";
        try {
          const t = await response.text();
          snippet = t.slice(0, 200);
        } catch {
          // ignore
        }
        return new ScraperHttpError(
          page,
          scanStep,
          url,
          snippet,
          response.status,
          undefined,
        );
      }
      return await response.text();
    } catch (err) {
      return new ScraperHttpError(
        page,
        scanStep,
        url,
        err instanceof Error ? err.message : String(err),
        500,
        undefined,
      );
    }
  }

  /**
   * Fetches the total number of pages from the anime list.
   */
  async getTotalPages(): Promise<
    Result<number, ScraperHttpError | ScraperParseError>
  > {
    const url = `${BASE_URL}/animeList.php?page=1`;

    const text = await this.fetchText(url, 1);
    if (isError(text)) return text;

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(text, "text/html");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return new ScraperParseError(
        1,
        ScraperScanStep.PAGINATION,
        url,
        errMsg,
        `Unexpected parsing error: ${errMsg}`,
      );
    }

    const pageLinks = doc.querySelectorAll(".page_number a");
    if (pageLinks.length === 0) {
      return new ScraperParseError(
        1,
        ScraperScanStep.PAGINATION,
        url,
        doc.body.innerHTML.substring(0, 500),
        "Pagination element not found",
      );
    }

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    if (!lastPageText) {
      return new ScraperParseError(
        1,
        ScraperScanStep.PAGINATION,
        url,
        doc.body.innerHTML.substring(0, 500),
        "No pagination text",
      );
    }

    const totalPages = parseInt(lastPageText, 10);
    if (isNaN(totalPages)) {
      return new ScraperParseError(
        1,
        ScraperScanStep.PAGINATION,
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
  ): Result<AnimeItem, ScraperParseError> {
    const href = card.getAttribute("href");
    if (!href) {
      return new ScraperParseError(
        page,
        ScraperScanStep.TITLE,
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
      return new ScraperParseError(
        page,
        ScraperScanStep.TITLE,
        url,
        card.outerHTML.substring(0, 500),
        "Anime title missing",
      );
    }

    const watchCountEl = card.querySelector(
      "p:not(.theme-name):not(.theme-time)",
    );
    if (!watchCountEl || !watchCountEl.textContent) {
      return new ScraperParseError(
        page,
        ScraperScanStep.WATCH_COUNT,
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
      return new ScraperParseError(
        page,
        ScraperScanStep.WATCH_COUNT,
        url,
        card.outerHTML.substring(0, 500),
        "Failed to parse watch count",
      );
    }

    const detailBlock = card.querySelector(".theme-detail-info-block");
    if (!detailBlock) {
      return new ScraperParseError(
        page,
        ScraperScanStep.EPISODE_COUNT,
        url,
        card.outerHTML.substring(0, 500),
        "Detail block missing",
      );
    }

    const epEl = detailBlock.querySelector(".theme-number");

    if (!epEl || !epEl.textContent) {
      return new ScraperParseError(
        page,
        ScraperScanStep.EPISODE_COUNT,
        url,
        detailBlock.outerHTML,
        "Episode count missing",
      );
    }

    const timeEl = detailBlock.querySelector(".theme-time");
    if (!timeEl || !timeEl.textContent) {
      return new ScraperParseError(
        page,
        ScraperScanStep.UPLOAD_DATE,
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
      return new ScraperParseError(
        page,
        ScraperScanStep.EPISODE_COUNT,
        url,
        epEl.outerHTML,
        "Failed to parse episode count",
      );
    }

    const yearStr = timeEl.textContent.replace("年份：", "").trim();
    const uploadDate = new Date(`${yearStr}-01-01T00:00:00Z`);
    if (isNaN(uploadDate.getTime())) {
      return new ScraperParseError(
        page,
        ScraperScanStep.UPLOAD_DATE,
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
  async scrapeListPage(pageNum: number): Promise<ScraperResult> {
    const url = `${BASE_URL}/animeList.php?page=${pageNum}`;
    const text = await this.fetchText(url, pageNum);
    if (isError(text)) {
      return {
        items: [],
        httpErrors: [text],
        parseErrors: [],
      };
    }

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(text, "text/html");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return {
        items: [],
        httpErrors: [],
        parseErrors: [
          new ScraperParseError(
            pageNum,
            ScraperScanStep.TITLE,
            url,
            errMsg,
            `Unexpected page parsing error: ${errMsg}`,
          ),
        ],
      };
    }

    const cards = doc.querySelectorAll("a.theme-list-main");

    const items: AnimeItem[] = [];
    const httpErrors: ScraperHttpError[] = [];
    const parseErrors: ScraperParseError[] = [];

    for (const card of Array.from(cards)) {
      const res = this.parseAnimeCard(card, url, pageNum);
      if (isError(res)) {
        parseErrors.push(res);
      } else {
        items.push(res);
      }
    }

    return { items, httpErrors, parseErrors };
  }

  /**
   * Scrapes details for a single anime item.
   */
  async scrapeAnimeDetails(
    link: string,
    page = 1,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>> {
    const text = await this.fetchText(link, page, ScraperScanStep.TITLE);
    if (isError(text)) return text;

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(text, "text/html");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      return new ScraperParseError(
        page,
        ScraperScanStep.DESCRIPTION,
        link,
        errMsg,
        `Unexpected details parsing error: ${errMsg}`,
      );
    }

    const scoreNumDiv = doc.querySelector(".score-overall-number");
    if (!scoreNumDiv || !scoreNumDiv.textContent) {
      return new ScraperParseError(
        page,
        ScraperScanStep.SCORE,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Score element missing",
      );
    }
    const score = parseFloat(scoreNumDiv.textContent);
    if (isNaN(score)) {
      return new ScraperParseError(
        page,
        ScraperScanStep.SCORE,
        link,
        scoreNumDiv.outerHTML,
        "Failed to parse score",
      );
    }

    const scorePeopleDiv = doc.querySelector(".score-overall-people");
    if (!scorePeopleDiv || !scorePeopleDiv.textContent) {
      return new ScraperParseError(
        page,
        ScraperScanStep.RATING_COUNT,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Rating count element missing",
      );
    }
    const ratingCount = parseInt(
      scorePeopleDiv.textContent.replace("人評價", "").replace(/,/g, ""),
      10,
    );
    if (isNaN(ratingCount)) {
      return new ScraperParseError(
        page,
        ScraperScanStep.RATING_COUNT,
        link,
        scorePeopleDiv.outerHTML,
        "Failed to parse rating count",
      );
    }

    const descDiv = doc.querySelector(".data-intro p");
    if (!descDiv || !descDiv.textContent?.trim()) {
      return new ScraperParseError(
        page,
        ScraperScanStep.DESCRIPTION,
        link,
        doc.body.innerHTML.substring(0, 200),
        "Description missing",
      );
    }
    const description = descDiv.textContent.trim();

    return { score, ratingCount, description };
  }

  /**
   * Pipeline scraping where stage 1 page fetching feeds items dynamically to stage 2 details fetching.
   */
  scanAllWithPipeline(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    options?: PipelineOptions,
  ): Observable<ScanEvent> {
    const pipeline = new ScraperPipeline(
      totalPages,
      pageConcurrency,
      detailConcurrency,
      filterItem,
      this,
      options,
    );
    return pipeline.execute();
  }
}

export const scraperService = new ScraperService();
