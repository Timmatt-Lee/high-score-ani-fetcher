import type { ScraperHttpError, ScraperParseError } from "../services/scraper";
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

export interface ScanCompleteResult {
  newSearchItems: AnimeItem[];
  updatedFavoriteList: AnimeItem[];
  updatedTrashList: AnimeItem[];
}

export interface ScraperResult {
  items: AnimeItem[];
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
  failedDetails?: AnimeItem[];
}
