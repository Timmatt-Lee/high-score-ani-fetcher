import {
  type AnimeItem,
  type ScanResult,
  type AnimeScraper,
} from "../types/anime";
import { ScraperHttpError, ScraperParseError } from "../errors";
import PQueue from "p-queue";

/**
 * Encapsulates the state and logic for a two-stage concurrent scraping pipeline.
 * Stage 1: Fetches list pages and enqueues items.
 * Stage 2: Fetches details for each enqueued item.
 */
export class ScraperPipeline {
  private results: AnimeItem[] = [];
  private httpErrors: ScraperHttpError[] = [];
  private parseErrors: ScraperParseError[] = [];
  private pageQueue: PQueue;
  private detailQueue: PQueue;
  private pagesCompleted = 0;
  private detailsCompleted = 0;
  private detailsTotal = 0;

  private totalPages: number;
  private filterItem: (item: AnimeItem) => boolean;
  private onProgress: (
    pagesCompleted: number,
    pagesTotal: number,
    detailsCompleted: number,
    detailsTotal: number,
    currentTitle: string,
  ) => void;
  private scraper: AnimeScraper;

  constructor(
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
    scraper: AnimeScraper,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.onProgress = onProgress;
    this.scraper = scraper;
    this.pageQueue = new PQueue({ concurrency: pageConcurrency });
    this.detailQueue = new PQueue({ concurrency: detailConcurrency });
  }

  /**
   * Orchestrates the execution of both pipeline stages.
   */
  async execute(): Promise<ScanResult> {
    const pagePromises = Array.from(
      { length: this.totalPages },
      (_, i) => i + 1,
    ).map((page) => this.pageQueue.add(() => this.fetchPage(page)));

    // Wait for all list pages to be fetched.
    // Errors are captured internally within fetchPage, so these promises always resolve.
    await Promise.all(pagePromises);

    // Wait for all dynamically queued details requests to finish
    await this.detailQueue.onIdle();

    return {
      items: this.results,
      httpErrors: this.httpErrors,
      parseErrors: this.parseErrors,
    };
  }

  private async fetchPage(page: number): Promise<void> {
    try {
      const { items: pageItems, parseErrors: pageErrors } =
        await this.scraper.scrapeListPage(page);
      this.parseErrors.push(...pageErrors);

      pageItems.forEach((item) => {
        if (this.filterItem(item)) {
          this.detailsTotal++;
          this.detailQueue.add(() => this.fetchDetail(item));
        }
      });
    } catch (err) {
      this.captureError(
        err,
        `https://ani.gamer.com.tw/animeList.php?page=${page}`,
      );
    }
    this.pagesCompleted++;
    this.reportProgress("");
  }

  private async fetchDetail(item: AnimeItem): Promise<void> {
    this.reportProgress(item.title);
    try {
      const details = await this.scraper.scrapeAnimeDetails(item.link);
      this.results.push({ ...item, ...details });
    } catch (err) {
      this.captureError(err, item.link);
    }
    this.detailsCompleted++;
    this.reportProgress(item.title);
  }

  private captureError(err: unknown, url: string): void {
    if (err instanceof ScraperHttpError) {
      this.httpErrors.push(err);
    } else if (err instanceof ScraperParseError) {
      this.parseErrors.push(err);
    } else {
      this.httpErrors.push(
        new ScraperHttpError(
          url,
          err instanceof Error ? err.message : String(err),
          500,
        ),
      );
    }
  }

  private reportProgress(currentTitle: string): void {
    this.onProgress(
      this.pagesCompleted,
      this.totalPages,
      this.detailsCompleted,
      this.detailsTotal,
      currentTitle,
    );
  }
}
