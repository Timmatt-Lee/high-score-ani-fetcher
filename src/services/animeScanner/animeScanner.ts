import { isError } from "../../types/result";
import { Subject, type Observable } from "rxjs";
import { AnimeScraper } from "./animeScraper";
import {
  type AnimeScanEvent,
  type PipelineOptions,
  type AnimeItem,
  AnimeScanPageEvent,
} from "./types";

/**
 * Encapsulates the state and logic for a two-stage sequential scanning process.
 * Stage 1: Fetches list pages sequentially.
 * Stage 2: Fetches details for each filtered item sequentially.
 */
export class AnimeScanner {
  private totalPages: number;
  private filterItem: (item: AnimeItem) => boolean;
  private scraper: AnimeScraper;
  private options?: PipelineOptions;
  private eventSubject = new Subject<AnimeScanEvent>();

  constructor(
    totalPages: number,
    filterItem: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
    options?: PipelineOptions,
  ) {
    this.totalPages = totalPages;
    this.filterItem = filterItem;
    this.scraper = scraper;
    this.options = options;
  }

  scan(): Observable<AnimeScanEvent> {
    const run = async () => {
      const pagesToScan =
        this.options?.onlyPages ??
        Array.from({ length: this.totalPages }, (_, i) => i + 1);

      const itemsToScan: { item: AnimeItem; page: number }[] = [];

      for (let i = 0; i < pagesToScan.length; i++) {
        const page = pagesToScan[i];
        try {
          const pageResult = await this.scraper.scrapeAnimesOnPage(page);
          for (const error of pageResult.httpErrors) {
            this.eventSubject.next(error);
          }
          for (const error of pageResult.parseErrors) {
            this.eventSubject.next(error);
          }
          for (const item of pageResult.animeItems) {
            if (this.filterItem(item)) {
              itemsToScan.push({ item, page });
            }
          }
          this.eventSubject.next(
            new AnimeScanPageEvent(i + 1, pagesToScan.length),
          );
        } catch (err) {
          this.eventSubject.error(err);
          return;
        }
      }

      try {
        for (const { item, page } of itemsToScan) {
          await this.fetchDetail(item, page);
        }
      } catch (err) {
        this.eventSubject.error(err);
        return;
      }

      this.eventSubject.complete();
    };
    run();
    return this.eventSubject.asObservable();
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
