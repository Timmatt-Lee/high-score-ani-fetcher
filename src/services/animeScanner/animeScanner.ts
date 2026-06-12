import { isError } from "../../types/result";
import PQueue from "p-queue";
import { Subject, type Observable } from "rxjs";
import { AnimeScraper } from "./animeScraper";
import {
  type AnimeScanEvent,
  type PipelineOptions,
  type AnimeItem,
} from "./types";

/**
 * Encapsulates the state and logic for a two-stage concurrent scanning process.
 * Stage 1: Fetches list pages and enqueues items.
 * Stage 2: Fetches details for each enqueued item.
 */
export class AnimeScanner {
  private pageQueue: PQueue;
  private detailQueue: PQueue;

  private totalPages: number;
  private filterItem: (item: AnimeItem) => boolean;
  private scraper: AnimeScraper;
  private options?: PipelineOptions;
  private eventSubject = new Subject<AnimeScanEvent>();

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

  scan(): Observable<AnimeScanEvent> {
    const run = async () => {
      const pagePromises = [];
      const pagesToScan =
        this.options?.onlyPages ??
        Array.from({ length: this.totalPages }, (_, i) => i + 1);

      try {
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
      this.eventSubject.next(error);
    }
    for (const error of pageResult.parseErrors) {
      this.eventSubject.next(error);
    }

    pageResult.animeItems.forEach((item: AnimeItem) => {
      if (this.filterItem(item)) {
        this.detailQueue
          .add(() => this.fetchDetail(item, page))
          .catch((err) => {
            this.eventSubject.error(
              err instanceof Error ? err : new Error(String(err)),
            );
          });
      }
    });
  }

  private async fetchDetail(item: AnimeItem, page: number): Promise<void> {
    const res = await this.scraper.scrapeAnimeDetails(
      item.link,
      page,
      item.title,
    );
    if (isError(res)) {
      res.animeName = item.title;
      this.eventSubject.next(res);
    } else {
      const fullItem = { ...item, ...res };
      this.eventSubject.next(fullItem);
    }
  }
}
