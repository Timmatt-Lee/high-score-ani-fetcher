import { AnimeScanStep } from "./animeScanStep";
import { AnimeScanHttpError, AnimeScanParseError } from "./animeScanError";
import { type AnimeItem, type AnimeDetails, type AnimeInfo } from "./types";

const BASE_URL = "https://ani.gamer.com.tw";

/**
 * Service to handle scanning total pages, scraping anime lists,
 * scraping details, and sequential scanning loops.
 */
export class AnimeScanner {
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async fetchUrl(
    url: string,
    page: number,
    scanStep: AnimeScanStep,
    animeName?: string,
  ): Promise<string> {
    let responseText: string | null = null;
    let responseStatus = 200;
    let isOk = true;

    // Check if an open tab on ani.gamer.com.tw exists to execute same-origin fetch and bypass Cloudflare WAF challenge
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.scripting) {
      try {
        const tabs = await chrome.tabs.query({ url: "*://ani.gamer.com.tw/*" });
        const targetTabId = tabs[0]?.id;
        if (targetTabId !== undefined) {
          const [firstResult] = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            func: async (targetUrl: string) => {
              const resp = await fetch(targetUrl, { credentials: "include" });
              const text = await resp.text();
              return {
                ok: resp.ok,
                status: resp.status,
                text,
              };
            },
            args: [url],
          });

          if (firstResult?.result) {
            isOk = firstResult.result.ok;
            responseStatus = firstResult.result.status;
            responseText = firstResult.result.text;
          }
        }
      } catch {
        // Fall back to direct fetch if scripting fails or is disallowed
      }
    }

    if (responseText === null) {
      let response: Response;
      try {
        response = await fetch(url, {
          credentials: "include",
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        throw new AnimeScanHttpError(
          page,
          scanStep,
          url,
          errorMsg,
          0,
          animeName,
        );
      }

      isOk = response.ok;
      responseStatus = response.status;
      try {
        responseText = await response.text();
      } catch {
        responseText = "";
      }
    }

    if (isOk && responseText !== null) {
      return responseText;
    }

    const snippet = responseText ? responseText.slice(0, 200) : "";
    throw new AnimeScanHttpError(
      page,
      scanStep,
      url,
      snippet,
      responseStatus,
      animeName,
    );
  }

  /**
   * Fetches the total number of pages from the anime list.
   */
  async getTotalPages(): Promise<number> {
    const url = `${BASE_URL}/animeList.php?page=1`;
    const text = await this.fetchUrl(url, 1, AnimeScanStep.GET_TOTAL_PAGES);

    const doc = new DOMParser().parseFromString(text, "text/html");
    const pageLinks = doc.querySelectorAll(".page_number a");
    if (pageLinks.length === 0) {
      throw new AnimeScanParseError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        url,
        doc.body.innerHTML.substring(0, 500),
        "Pagination element not found",
      );
    }

    const lastPageText = pageLinks[pageLinks.length - 1].textContent;
    if (!lastPageText) {
      throw new AnimeScanParseError(
        1,
        AnimeScanStep.GET_TOTAL_PAGES,
        url,
        doc.body.innerHTML.substring(0, 500),
        "No pagination text",
      );
    }

    const totalPages = parseInt(lastPageText, 10);
    if (isNaN(totalPages)) {
      throw new AnimeScanParseError(
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
   * Parses a single anime card element into an AnimeInfo.
   */
  private parseAnimeCard(card: Element, url: string, page: number): AnimeInfo {
    const href = card.getAttribute("href");
    if (!href) {
      throw new AnimeScanParseError(
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
      throw new AnimeScanParseError(
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
      throw new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Watch count element missing",
      );
    }

    const str = watchCountEl.textContent.trim();
    let watchCount = 0;
    if (str && str !== "統計中") {
      const parsed = str.includes("萬")
        ? Math.floor(parseFloat(str.replace("萬", "")) * 10000)
        : parseInt(str.replace(/,/g, ""), 10);
      if (!isNaN(parsed)) {
        watchCount = parsed;
      }
    }

    const detailBlock = card.querySelector(".theme-detail-info-block");
    if (!detailBlock) {
      throw new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        card.outerHTML.substring(0, 500),
        "Detail block missing",
      );
    }

    const epEl = detailBlock.querySelector(".theme-number");
    if (!epEl || !epEl.textContent) {
      throw new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        detailBlock.outerHTML,
        "Episode count missing",
      );
    }

    const timeEl = detailBlock.querySelector(".theme-time");
    if (!timeEl || !timeEl.textContent) {
      throw new AnimeScanParseError(
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
      throw new AnimeScanParseError(
        page,
        AnimeScanStep.PARSE_ANIME_INFO,
        url,
        epEl.outerHTML,
        "Failed to parse episode count",
      );
    }

    const yearStr = timeEl.textContent.replace("年份：", "").trim();
    const parts = yearStr.split("/");
    const year = parseInt(parts[0], 10);
    const month = parts[1] ? parseInt(parts[1], 10) - 1 : 0;

    const uploadDate = new Date(Date.UTC(year, month, 1));
    if (isNaN(year) || isNaN(uploadDate.getTime())) {
      throw new AnimeScanParseError(
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
      uploadDate: uploadDate.toISOString(),
    };
  }

  /**
   * Scans basic info for all items on a single page.
   */
  async scanAnimesOnPage(page: number): Promise<AnimeInfo[]> {
    const url = `${BASE_URL}/animeList.php?page=${page}`;
    const text = await this.fetchUrl(url, page, AnimeScanStep.SCAN_LIST_PAGE);

    const doc = new DOMParser().parseFromString(text, "text/html");
    const cards = doc.querySelectorAll("a.theme-list-main");

    const animeInfos: AnimeInfo[] = [];
    for (const card of Array.from(cards)) {
      const res = this.parseAnimeCard(card, url, page);
      animeInfos.push(res);
    }

    return animeInfos;
  }

  /**
   * Scans details for a single anime item.
   */
  async scanAnimeDetail(
    link: string,
    page: number,
    animeName?: string,
  ): Promise<AnimeDetails> {
    const text = await this.fetchUrl(
      link,
      page,
      AnimeScanStep.PARSE_ANIME_DETAIL,
      animeName,
    );

    const doc = new DOMParser().parseFromString(text, "text/html");

    // --- Parse score ---
    const scoreEl = doc.querySelector(".score-overall-number");
    let score = 0;
    if (scoreEl && scoreEl.textContent?.trim()) {
      const parsedScore = parseFloat(scoreEl.textContent.trim());
      if (!isNaN(parsedScore)) {
        score = parsedScore;
      }
    }

    // --- Parse rating count ---
    const ratingEl = doc.querySelector(".score-overall-people");
    let ratingCount = 0;
    if (ratingEl && ratingEl.textContent?.trim()) {
      const parsedRating = parseInt(
        ratingEl.textContent.replace(/[^0-9]/g, ""),
        10,
      );
      if (!isNaN(parsedRating)) {
        ratingCount = parsedRating;
      }
    }

    // --- Parse description ---
    const descDiv = doc.querySelector(".data-intro p");
    const description =
      descDiv && descDiv.textContent?.trim() ? descDiv.textContent.trim() : "";

    return { score, ratingCount, description };
  }

  /**
   * Stage 1: Scans index pages sequentially.
   * Returns a list of all scraped AnimeInfo.
   */
  async scanPages(options: {
    totalPages: number;
    requestDelayMs: number;
    onPageScanned: (page: number, items: AnimeInfo[]) => void;
    signal?: AbortSignal;
  }): Promise<AnimeInfo[]> {
    const allItems: AnimeInfo[] = [];
    for (let page = 1; page <= options.totalPages; page++) {
      options.signal?.throwIfAborted();
      const pageItems = await this.scanAnimesOnPage(page);
      allItems.push(...pageItems);
      options.onPageScanned(page, pageItems);

      if (page < options.totalPages) {
        await this.delay(options.requestDelayMs);
      }
    }
    return allItems;
  }

  /**
   * Stage 2: Scans detail pages sequentially for a list of items.
   */
  async scanAnimeDetails(options: {
    items: AnimeInfo[];
    requestDelayMs: number;
    onDetailScanned: (item: AnimeItem) => void;
    signal?: AbortSignal;
  }): Promise<void> {
    let completedCount = 0;
    for (const item of options.items) {
      options.signal?.throwIfAborted();
      const details = await this.scanAnimeDetail(item.link, 0, item.title);
      const fullItem: AnimeItem = {
        ...item,
        ...details,
        scannedAt: new Date().toISOString(),
      };
      completedCount++;
      options.onDetailScanned(fullItem);

      if (completedCount < options.items.length) {
        await this.delay(options.requestDelayMs);
      }
    }
  }
}

export const animeScanner = new AnimeScanner();
