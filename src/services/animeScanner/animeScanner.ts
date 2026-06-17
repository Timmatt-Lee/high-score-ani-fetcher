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
  private animeCache: Record<string, import("./types").AnimeCacheItem>;
  private settings: import("../../types/settings").Settings;
  private options?: PipelineOptions;
  private eventSubject = new Subject<AnimeScanEvent>();

  constructor(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
    animeCache: Record<string, import("./types").AnimeCacheItem>,
    settings: import("../../types/settings").Settings,
    options?: PipelineOptions,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.scraper = scraper;
    this.animeCache = animeCache;
    this.settings = settings;
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

    const skipThreshold =
      this.settings.targetScore * this.settings.rescanThresholdRatio;
    const expireMs = this.settings.cacheExpireDays * 24 * 60 * 60 * 1000;

    pageResult.animeItems.forEach((item: AnimeItem) => {
      if (!this.filterItem(item)) {
        return;
      }

      const snMatch = item.link.match(/sn=(\d+)/);
      const sn = snMatch ? snMatch[1] : item.link;
      const cached = this.animeCache[sn];

      // If cached doesn't exist, we must fetch.
      if (cached) {
        if (cached.score < skipThreshold) {
          // Score is too low: permanently skip this.
          // Note: even if expireDays is 0, we still skip low scores as requested.
          return;
        }

        // Score is good. Is it fresh?
        const isFresh =
          expireMs > 0 && Date.now() - cached._cacheTimestamp < expireMs;

        if (isFresh) {
          // Inject cached item immediately
          this.eventSubject.next({ ...cached, uploadDate: item.uploadDate });
          return;
        }
      }

      this.detailQueue
        .add(() => this.fetchDetail(item, page))
        .catch((err) => this.eventSubject.error(err));
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
