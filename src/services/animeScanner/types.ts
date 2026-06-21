import { z } from "zod";
import { type AnimeScanError } from "./animeScanError";

export class AnimeScanPageEvent {
  constructor(
    public currentPage: number,
    public totalPages: number,
  ) {}
}

export type AnimeScanEvent = AnimeItem | AnimeScanError | AnimeScanPageEvent;

export interface PipelineOptions {
  onlyPages?: number[];
  requestDelayMs: number; // delay between requests to avoid rate limiting
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
  scannedAt: z.coerce.date().optional(),
});

export const AnimeItemSchema = AnimeInfoSchema.merge(AnimeDetailsSchema);

export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeInfo = z.infer<typeof AnimeInfoSchema>;
export type AnimeItem = z.infer<typeof AnimeItemSchema>;

export const SettingsSchema = z.object({
  targetScore: z.number().default(4.8),
  rescanThreshold: z.number().default(95),
  cacheExpireDays: z.number().default(14),
  requestDelayMs: z.number().default(800),
});

export type Settings = z.infer<typeof SettingsSchema>;
