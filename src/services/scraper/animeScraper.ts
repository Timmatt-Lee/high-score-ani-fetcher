import { type Observable } from "rxjs";
import { type Result } from "../../types/result";
import { type ScraperError } from "./scraperError";
import { type AnimeItem, type AnimeDetails, type ScraperResult } from "./types";

export enum ScanEventType {
  PAGE,
  ANIME_DETAIL,
  COMPLETED,
}

export type ScanEvent =
  | { type: ScanEventType.PAGE; page: number; isSuccess: boolean }
  | { type: ScanEventType.ANIME_DETAIL; title: string; isSuccess: boolean }
  | { type: ScanEventType.COMPLETED; result: ScraperResult };

export interface PipelineOptions {
  onlyPages?: number[];
}

export abstract class AnimeScraper {
  abstract getTotalPages(): Promise<Result<number, ScraperError>>;
  abstract scrapeAnimesOnPage(page: number): Promise<ScraperResult>;
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
