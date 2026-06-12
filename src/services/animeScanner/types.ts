import { z } from "zod";
import { type AnimeScanError } from "./animeScanError";

export type AnimeScanEvent = AnimeItem | AnimeScanError;

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
