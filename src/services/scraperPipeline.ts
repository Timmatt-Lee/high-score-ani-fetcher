import {
  type AnimeItem,
  type AnimeScraper,
  type ScanEvent,
} from "../types/anime";
import { ScraperHttpError, ScraperParseError } from "../errors";
import { isError } from "../types/result";
import PQueue from "p-queue";
import { Subject, type Observable } from "rxjs";

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
  private eventSubject = new Subject<ScanEvent>();

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.scraper = scraper;
    this.pageQueue = new PQueue({ concurrency: pageConcurrency });
    this.detailQueue = new PQueue({ concurrency: detailConcurrency });
  }

  execute(): Observable<ScanEvent> {
    const run = async () => {
      try {
        const pagePromises = [];
        for (let page = 1; page <= this.totalPages; page++) {
          pagePromises.push(this.pageQueue.add(() => this.fetchPage(page)));
        }
        await Promise.all(pagePromises);
        await this.detailQueue.onIdle();
        this.eventSubject.next({
          type: "completed",
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
    const pageResult = await this.scraper.scrapeListPage(page);
    this.httpErrors.push(...pageResult.httpErrors);
    this.parseErrors.push(...pageResult.parseErrors);

    pageResult.items.forEach((item) => {
      if (this.filterItem(item)) {
        this.detailsTotalCount++;
        this.detailQueue.add(() => this.fetchDetail(item));
      }
    });
    this.pagesCompletedCount++;
    this.eventSubject.next({
      type: "page_completed",
      pageNum: page,
      success:
        pageResult.httpErrors.length === 0 &&
        pageResult.parseErrors.length === 0,
    });
  }

  private async fetchDetail(item: AnimeItem): Promise<void> {
    const res = await this.scraper.scrapeAnimeDetails(item.link);
    let isSuccessful = true;
    if (isError(res)) {
      isSuccessful = false;
      if (res instanceof ScraperHttpError) {
        this.httpErrors.push(res);
      } else {
        this.parseErrors.push(res);
      }
    } else {
      this.results.push({ ...item, ...res });
    }
    this.detailsCompletedCount++;
    this.eventSubject.next({
      type: "detail_completed",
      title: item.title,
      success: isSuccessful,
    });
  }
}
