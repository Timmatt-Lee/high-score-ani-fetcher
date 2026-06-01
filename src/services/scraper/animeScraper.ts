import { type Observable } from "rxjs";
import {
  type AnimeItem,
  type AnimeDetails,
  type ScraperResult,
} from "../../types/anime";
import { type Result } from "../../types/result";
import { type ScraperError } from "./scraperError";

export enum ScanEventType {
  PAGE_COMPLETED = "page_completed",
  DETAIL_COMPLETED = "detail_completed",
  COMPLETED = "completed",
}

export type ScanEvent =
  | { type: ScanEventType.PAGE_COMPLETED; page: number; isSuccess: boolean }
  | { type: ScanEventType.DETAIL_COMPLETED; title: string; isSuccess: boolean }
  | { type: ScanEventType.COMPLETED; result: ScraperResult };

export interface PipelineOptions {
  onlyPages?: number[];
  onlyAnimeItems?: AnimeItem[];
}

export abstract class AnimeScraper {
  abstract getTotalPages(): Promise<Result<number, ScraperError>>;
  abstract scrapeListPage(page: number): Promise<ScraperResult>;
  abstract scrapeAnimeDetails(
    link: string,
    page: number,
  ): Promise<Result<AnimeDetails, ScraperError>>;
  abstract scanAllWithPipeline(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
    options?: PipelineOptions,
  ): Observable<ScanEvent>;
}
