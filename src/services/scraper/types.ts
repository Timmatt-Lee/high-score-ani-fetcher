import { z } from "zod";
import { type ScraperHttpError, type ScraperParseError } from "./scraperError";

export enum ScanEventType {
  ANIME_DETAIL,
  COMPLETED,
}

export type ScanEvent =
  | { type: ScanEventType.ANIME_DETAIL; title: string; isSuccess: boolean }
  | { type: ScanEventType.COMPLETED; result: ScraperResult };

export interface PipelineOptions {
  onlyPages?: number[];
}

export const AnimeDetailsSchema = z.object({
  score: z.number(),
  ratingCount: z.number(),
  description: z.string(),
});

export const AnimeInfoSchema = z.object({
  link: z.string(),
  title: z.string(),
  watchCount: z.number(),
  episodeCount: z.number(),
  uploadDate: z.coerce.date(),
});

export const AnimeItemSchema = AnimeInfoSchema.merge(AnimeDetailsSchema);

export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeInfo = z.infer<typeof AnimeInfoSchema>;
export type AnimeItem = z.infer<typeof AnimeItemSchema>;

export interface ScraperResult {
  animeItems: AnimeItem[];
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
}
