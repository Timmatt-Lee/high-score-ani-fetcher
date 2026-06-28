import { Subject, type Observable } from "rxjs";
import { AnimeScraper } from "./animeScraper";
import {
  type AnimeScanEvent,
  type ScannerOptions,
  type AnimeItem,
  AnimeScanPageEvent,
  AnimeScanSkippedEvent,
  AnimeScanQueuedEvent,
} from "./types";

/**
 * Encapsulates the state and logic for a two-stage sequential scanning process.
 * Stage 1: Fetches list pages sequentially.
 * Stage 2: Fetches details for each filtered item sequentially.
 */
export class AnimeScanner {
  private totalPages: number;
  private isScanRequired: (item: AnimeItem) => boolean;
  private scraper: AnimeScraper;
  private options: ScannerOptions;
  private eventSubject = new Subject<AnimeScanEvent>();

  constructor(
    totalPages: number,
    isScanRequired: (item: AnimeItem) => boolean,
    scraper: AnimeScraper,
    options: ScannerOptions,
  ) {
    this.totalPages = totalPages;
    this.isScanRequired = isScanRequired;
    this.scraper = scraper;
    this.options = options;
  }

  scan(): Observable<AnimeScanEvent> {
    const run = async () => {
      const pagesToScan = Array.from(
        { length: this.totalPages },
        (_, i) => i + 1,
      );

      const itemsToScan: { item: AnimeItem; page: number }[] = [];

      for (let i = 0; i < pagesToScan.length; i++) {
        const page = pagesToScan[i];
        try {
          const animeItems = await this.scraper.scrapeAnimesOnPage(page);
          for (const item of animeItems) {
            if (this.isScanRequired(item)) {
              itemsToScan.push({ item, page });
              this.eventSubject.next(new AnimeScanQueuedEvent(item));
            } else {
              this.eventSubject.next(new AnimeScanSkippedEvent(item));
            }
          }
          this.eventSubject.next(
            new AnimeScanPageEvent(i + 1, pagesToScan.length),
          );
          // Apply delay between page requests to respect rate limits
          await this.scraper.delay(this.options.requestDelayMs);
        } catch (err) {
          this.eventSubject.error(err);
          return;
        }
      }

      try {
        for (const { item, page } of itemsToScan) {
          await this.fetchDetail(item, page);
          // Delay between detail requests to avoid hitting rate limits
          await this.scraper.delay(this.options.requestDelayMs);
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
    const fullItem = { ...item, ...res, scannedAt: new Date().toISOString() };
    this.eventSubject.next(fullItem);
  }
}
