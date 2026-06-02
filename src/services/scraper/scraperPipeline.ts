import { ScraperHttpError, ScraperParseError } from "./scraperError";
import { isError } from "../../types/result";
import PQueue from "p-queue";
import { Subject, type Observable } from "rxjs";
import {
  ScanEventType,
  type ScanEvent,
  type PipelineOptions,
  AnimeScraper,
} from "./animeScraper";
import { type AnimeItem } from "./types";

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
  private scraper: AnimeScraper;
  private options?: PipelineOptions;
  private eventSubject = new Subject<ScanEvent>();

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
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
        this.eventSubject.next({
          type: ScanEventType.COMPLETED,
          result: {
            items: this.results,
            httpErrors: this.httpErrors,
            parseErrors: this.parseErrors,
          },
        });
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
    this.httpErrors.push(...pageResult.httpErrors);
    this.parseErrors.push(...pageResult.parseErrors);

    pageResult.items.forEach((item) => {
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
    this.eventSubject.next({
      type: ScanEventType.PAGE_COMPLETED,
      page,
      isSuccess:
        pageResult.httpErrors.length === 0 &&
        pageResult.parseErrors.length === 0,
    });
  }

  private async fetchDetail(item: AnimeItem, page?: number): Promise<void> {
    const res = await this.scraper.scrapeAnimeDetails(item.link, page ?? 1);
    let isSuccessful = true;
    if (isError(res)) {
      isSuccessful = false;
      res.animeName = item.title;
      if (res instanceof ScraperHttpError) {
        this.httpErrors.push(res);
      } else {
        this.parseErrors.push(res as ScraperParseError);
      }
    } else {
      this.results.push({ ...item, ...res });
    }
    this.detailsCompletedCount++;
    this.eventSubject.next({
      type: ScanEventType.DETAIL_COMPLETED,
      title: item.title,
      isSuccess: isSuccessful,
    });
  }
}
