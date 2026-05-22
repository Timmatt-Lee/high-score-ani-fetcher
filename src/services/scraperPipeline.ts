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
  private httpErrors: ScraperHttpError[] = [];
  private parseErrors: ScraperParseError[] = [];
  private queue = new AsyncQueue<AnimeItem>();
  private pagesCompleted = 0;
  private detailsCompleted = 0;
  private detailsTotal = 0;
  private pageQueue: number[];

  private totalPages: number;
  private pageConcurrency: number;
  private detailConcurrency: number;
  private filterItem: (item: AnimeItem) => boolean;
  private onProgress: (
    pagesCompleted: number,
    pagesTotal: number,
    detailsCompleted: number,
    detailsTotal: number,
    currentTitle: string,
  ) => void;
  private scraper: {
    scrapeListPage: (
      page: number,
    ) => Promise<{ items: AnimeItem[]; parseErrors: ScraperParseError[] }>;
    scrapeAnimeDetails: (link: string) => Promise<{
      score: number;
      rating_count: number;
      description: string;
    }>;
  };

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
    scraper: {
      scrapeListPage: (
        page: number,
      ) => Promise<{ items: AnimeItem[]; parseErrors: ScraperParseError[] }>;
      scrapeAnimeDetails: (link: string) => Promise<{
        score: number;
        rating_count: number;
        description: string;
      }>;
    },
  ) {
    this.totalPages = totalPages;
    this.pageConcurrency = pageConcurrency;
    this.detailConcurrency = detailConcurrency;
    this.filterItem = filterItem;
    this.onProgress = onProgress;
    this.scraper = scraper;
    this.pageQueue = [...Array(totalPages).keys()].map((i) => i + 1);
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

    return {
      items: this.results,
      httpErrors: this.httpErrors,
      parseErrors: this.parseErrors,
    };
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
      const { items: pageItems, parseErrors: pageErrors } =
        await this.scraper.scrapeListPage(page);
      this.parseErrors.push(...pageErrors);

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
