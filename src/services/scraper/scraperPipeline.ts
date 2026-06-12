import { ScraperHttpError, ScraperParseError } from "./scraperError";
import { isError } from "../../types/result";
import PQueue from "p-queue";
import { Subject, type Observable } from "rxjs";
import { ScraperService } from "./scraper";
import { type ScanEvent, type PipelineOptions, type AnimeItem } from "./types";

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
  private scraper: ScraperService;
  private options?: PipelineOptions;
  private eventSubject = new Subject<ScanEvent>();

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: ScraperService,
    options?: PipelineOptions,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.scraper = scraper;
    this.options = options;
    this.pageQueue = new PQueue({ concurrency: pageConcurrency });
    this.detailQueue = new PQueue({ concurrency: detailConcurrency });
  }

  execute(): Observable<ScanEvent> {
    const run = async () => {
      try {
        const pagePromises = [];
        const pagesToScan =
          this.options?.onlyPages ??
          Array.from({ length: this.totalPages }, (_, i) => i + 1);

        for (const page of pagesToScan) {
          pagePromises.push(this.pageQueue.add(() => this.fetchPage(page)));
        }

        await Promise.all(pagePromises);
        await this.detailQueue.onIdle();
        this.eventSubject.complete();
      } catch (err) {
        this.eventSubject.error(
          err instanceof Error ? err : new Error(String(err)),
        );
      }
    };
    run();
    return this.eventSubject.asObservable();
  }

  private async fetchPage(page: number): Promise<void> {
    const pageResult = await this.scraper.scrapeAnimesOnPage(page);
    for (const error of pageResult.httpErrors) {
      this.httpErrors.push(error);
      this.eventSubject.next(error);
    }
    for (const error of pageResult.parseErrors) {
      this.parseErrors.push(error);
      this.eventSubject.next(error);
    }

    pageResult.animeItems.forEach((item) => {
      if (this.filterItem(item)) {
        this.detailsTotalCount++;
        this.detailQueue
          .add(() => this.fetchDetail(item, page))
          .catch((err) => {
            this.eventSubject.error(
              err instanceof Error ? err : new Error(String(err)),
            );
          });
      }
    });
    this.pagesCompletedCount++;
  }

  private async fetchDetail(item: AnimeItem, page?: number): Promise<void> {
    const res = await this.scraper.scrapeAnimeDetails(
      item.link,
      page ?? 1,
      item.title,
    );
    if (isError(res)) {
      res.animeName = item.title;
      if (res instanceof ScraperHttpError) {
        this.httpErrors.push(res);
      } else {
        this.parseErrors.push(res as ScraperParseError);
      }
      this.detailsCompletedCount++;
      this.eventSubject.next(res);
    } else {
      const fullItem = { ...item, ...res };
      this.results.push(fullItem);
      this.detailsCompletedCount++;
      this.eventSubject.next(fullItem);
    }
  }
}
