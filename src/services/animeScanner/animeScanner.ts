import { isError } from "../../types/result";
import PQueue from "p-queue";
import { Subject, type Observable } from "rxjs";
import { AnimeScraper } from "./animeScraper";
import {
  type AnimeScanEvent,
  type PipelineOptions,
  type AnimeItem,
  type Settings,
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

  private existingAnimesMap: Map<string, AnimeItem>;
  private settings: Settings;

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
    existingAnimesMap: Map<string, AnimeItem>,
    settings: Settings,
    options?: PipelineOptions,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.scraper = scraper;

    this.existingAnimesMap = existingAnimesMap;
    this.settings = settings;
    this.options = options;
    this.pageQueue = new PQueue({
      concurrency: pageConcurrency,
      intervalCap: 2,
      interval: 1000,
    });
    this.detailQueue = new PQueue({
      concurrency: detailConcurrency,
      intervalCap: 10,
      interval: 1000,
    });
  }

  scan(): Observable<AnimeScanEvent> {
    const run = async () => {
      const pagePromises = [];
      const pagesToScan =
        this.options?.onlyPages ??
        Array.from({ length: this.totalPages }, (_, i) => i + 1);

      for (const page of pagesToScan) {
        pagePromises.push(this.pageQueue.add(() => this.fetchPage(page)));
      }

      try {
        await Promise.all(pagePromises);
        await this.detailQueue.onIdle();
      } catch (err) {
        this.eventSubject.error(err);
        return;
      }

      this.eventSubject.complete();
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
        const existing = this.existingAnimesMap.get(item.link);
        if (existing) {
          const now = Date.now();
          const scannedAt = existing.scannedAt
            ? existing.scannedAt.getTime()
            : 0;
          const expireMs = this.settings.cacheExpireDays * 24 * 60 * 60 * 1000;
          const isExpired = now - scannedAt > expireMs;

          const targetThresholdScore =
            this.settings.targetScore * (this.settings.rescanThreshold / 100);
          const isLowScore = existing.score < targetThresholdScore;

          if (!isExpired || isLowScore) {
            // Directly yield cached item!
            this.eventSubject.next(existing);
            return;
          }
        }

        this.detailQueue
          .add(() => this.fetchDetail(item, page))
          .catch((err) => this.eventSubject.error(err));
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
      const fullItem = { ...item, ...res, scannedAt: new Date() };
      this.eventSubject.next(fullItem);
    }
  }
}
