import { ScraperHttpError, ScraperParseError } from "../errors";
import { type Result } from "./result";
import { z } from "zod";
import { type Observable } from "rxjs";

export const AnimeDetailsSchema = z.object({
  score: z.number(),
  ratingCount: z.number(),
  description: z.string(),
});

export const AnimeItemSchema = AnimeDetailsSchema.extend({
  link: z.string(),
  title: z.string(),
  watchCount: z.number(),
  episodeCount: z.number(),
  uploadDate: z.coerce.date(),
});

export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeItem = z.infer<typeof AnimeItemSchema>;

export interface ScanCompleteResult {
  newSearchItems: AnimeItem[];
  updatedFavoriteList: AnimeItem[];
  updatedTrashList: AnimeItem[];
}

export interface ScraperResult {
  items: AnimeItem[];
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
}

export type ScanEvent =
  | { type: "page_completed"; pageNum: number; success: boolean }
  | { type: "detail_completed"; title: string; success: boolean }
  | { type: "completed"; result: ScraperResult };

export interface AnimeScraper {
  getTotalPages(): Promise<
    Result<number, ScraperHttpError | ScraperParseError>
  >;
  scrapeListPage(pageNum: number): Promise<ScraperResult>;
  scrapeAnimeDetails(
    link: string,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>>;
  scanAllWithPipeline(
    totalPages: number,
    pageConcurrency: number,
    detailConcurrency: number,
    filterItem: (item: AnimeItem) => boolean,
  ): Observable<ScanEvent>;
}
