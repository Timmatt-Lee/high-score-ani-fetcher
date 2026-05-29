import { ScraperHttpError, ScraperParseError } from "../errors";
import { type Result } from "./result";

import { z } from "zod";

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

export interface ScraperResult {
  items: AnimeItem[];
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
}

export type ScanProgressCallback = (
  pagesCompleted: number,
  pagesTotal: number,
  detailsCompleted: number,
  detailsTotal: number,
  currentTitle: string,
) => void;

export interface AnimeScraper {
  getTotalPages(): Promise<
    Result<number, ScraperHttpError | ScraperParseError>
  >;
  scrapeListPage(pageNum: number): Promise<ScraperResult>;
  scrapeAnimeDetails(
    link: string,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>>;
}
