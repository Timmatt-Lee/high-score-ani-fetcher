import {
  type AnimeItem,
  type ScraperResult,
  type AnimeScraper,
  type ScanProgressCallback,
} from "../types/anime";
import { ScraperHttpError, ScraperParseError } from "../errors";
import { isError } from "../types/result";
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
  async execute(): Promise<ScraperResult> {
    const pagePromises = [];
    for (let page = 1; page <= this.totalPages; page++) {
      pagePromises.push(this.pageQueue.add(() => this.fetchPage(page)));
    }

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
      const pageResult = await this.scraper.scrapeListPage(page);
      this.httpErrors.push(...pageResult.httpErrors);
      this.parseErrors.push(...pageResult.parseErrors);

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
      const res = await this.scraper.scrapeAnimeDetails(item.link);
      if (isError(res)) {
        if (res instanceof ScraperHttpError) {
          this.httpErrors.push(res);
        } else {
          this.parseErrors.push(res);
        }
      } else {
        this.results.push({ ...item, ...res });
      }
    } catch (err) {
      this.captureError(err, item.link);
    }
    this.detailsCompletedCount++;
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
      this.pagesCompletedCount,
      this.totalPages,
      this.detailsCompletedCount,
      this.detailsTotalCount,
      currentTitle,
    );
  }
}
