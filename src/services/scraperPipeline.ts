import { type AnimeItem, type ScanResult } from "../types/anime";
import { ScraperHttpError, ScraperParseError } from "../errors";
import { AsyncQueue } from "../concurrency/asyncQueue";

/**
 * Encapsulates the state and logic for a two-stage concurrent scraping pipeline.
 * Stage 1: Fetches list pages and enqueues items.
 * Stage 2: Fetches details for each enqueued item.
 */
export class ScraperPipeline {
  private results: AnimeItem[] = [];
  private errors: (ScraperHttpError | ScraperParseError)[] = [];
  private queue = new AsyncQueue<AnimeItem>();
  private pagesCompleted = 0;
  private detailsCompleted = 0;
  private detailsTotal = 0;
  private pageQueue: number[];

  constructor(
    private totalPages: number,
    private pageConcurrency: number,
    private detailConcurrency: number,
    private filterItem: (item: AnimeItem) => boolean,
    private onProgress: (
      pagesCompleted: number,
      pagesTotal: number,
      detailsCompleted: number,
      detailsTotal: number,
      currentTitle: string,
    ) => void,
    private scraper: {
      scrapeListPage: (
        page: number,
      ) => Promise<{ items: AnimeItem[]; errors: ScraperParseError[] }>;
      scrapeAnimeDetails: (
        link: string,
      ) => Promise<{
        score: number;
        rating_count: number;
        description: string;
      }>;
    },
  ) {
    this.pageQueue = Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  /**
   * Orchestrates the execution of both pipeline stages.
   */
  async execute(): Promise<ScanResult> {
    const pageWorkers = Array.from(
      { length: Math.min(this.pageConcurrency, this.totalPages) },
      () => this.runPageWorker(),
    );
    const detailWorkers = Array.from({ length: this.detailConcurrency }, () =>
      this.runDetailWorker(),
    );

    await Promise.all(pageWorkers);
    this.queue.close();
    await Promise.all(detailWorkers);

    return { items: this.results, errors: this.errors };
  }

  private async runPageWorker(): Promise<void> {
    while (true) {
      const page = this.pageQueue.shift();
      if (page === undefined) break;
      await this.fetchPage(page);
    }
  }

  private async fetchPage(page: number): Promise<void> {
    try {
      const { items: pageItems, errors: pageErrors } =
        await this.scraper.scrapeListPage(page);
      this.errors.push(...pageErrors);

      pageItems.forEach((item) => {
        if (this.filterItem(item)) {
          this.detailsTotal++;
          this.queue.push(item);
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

  private async runDetailWorker(): Promise<void> {
    while (true) {
      const item = await this.queue.next();
      if (item === undefined) break;
      await this.fetchDetail(item);
    }
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
      this.pagesCompleted,
      this.totalPages,
      this.detailsCompleted,
      this.detailsTotal,
      currentTitle,
    );
  }
}
