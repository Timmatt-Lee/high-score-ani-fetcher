import {
  type AnimeItem,
  type ScanResult,
  type AnimeScraper,
  type ScanProgressCallback,
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
  private errors: (ScraperHttpError | ScraperParseError)[] = [];
  private pageQueue: PQueue;
  private detailQueue: PQueue;
  private pagesCompletedCount = 0;
  private detailsCompletedCount = 0;
  private detailsTotalCount = 0;

  private totalPages: number;
  private filterItem: (item: AnimeItem) => boolean;
  private onProgress: ScanProgressCallback;
  private scraper: AnimeScraper;

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    onProgress: ScanProgressCallback,
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
      errors: this.errors,
    };
  }

  private async fetchPage(page: number): Promise<void> {
    try {
      const pageResult = await this.scraper.scrapeListPage(page);
      this.errors.push(...pageResult.errors);

      pageResult.items.forEach((item) => {
        if (this.filterItem(item)) {
          this.detailsTotalCount++;
          this.detailQueue.add(() => this.fetchDetail(item));
        }
      });
    } catch (err) {
      this.captureError(
        err,
        `https://ani.gamer.com.tw/animeList.php?page=${page}`,
      );
    }
    this.pagesCompletedCount++;
    this.reportProgress("");
  }

  private async fetchDetail(item: AnimeItem): Promise<void> {
    this.reportProgress(item.title);
    try {
      const detailsResult = await this.scraper.scrapeAnimeDetails(item.link);
      if (detailsResult.isSuccess) {
        this.results.push({ ...item, ...detailsResult.items });
      } else {
        this.errors.push(detailsResult.error);
      }
    } catch (err) {
      this.captureError(err, item.link);
    }
    this.detailsCompletedCount++;
    this.reportProgress(item.title);
  }

  private captureError(err: unknown, url: string): void {
    if (err instanceof ScraperHttpError || err instanceof ScraperParseError) {
      this.errors.push(err);
    } else {
      this.errors.push(
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
      this.pagesCompletedCount,
      this.totalPages,
      this.detailsCompletedCount,
      this.detailsTotalCount,
      currentTitle,
    );
  }
}
