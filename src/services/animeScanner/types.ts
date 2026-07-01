import { z } from "zod";

export interface ScannerOptions {
  requestDelayMs: number; // delay between requests to avoid rate limiting
}

export const AnimeDetailsSchema = z.object({
  score: z.number(),
  ratingCount: z.number(),
  description: z.string(),
});

const DateStringSchema = z.preprocess((val) => {
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "Invalid Date" : val.toISOString();
  }
  return val;
}, z.string());

export const AnimeInfoSchema = z.object({
  link: z.string(),
  title: z.string(),
  watchCount: z.number(),
  episodeCount: z.number(),
  uploadDate: DateStringSchema,
  scannedAt: DateStringSchema.optional(),
});

export const AnimeItemSchema = AnimeInfoSchema.merge(AnimeDetailsSchema);

export type AnimeDetails = z.infer<typeof AnimeDetailsSchema>;
export type AnimeInfo = z.infer<typeof AnimeInfoSchema>;
export type AnimeItem = z.infer<typeof AnimeItemSchema>;

export const SettingsSchema = z.object({
  targetScore: z.coerce
    .number()
    .transform((val) => Math.max(0.0, Math.min(5.0, val)))
    .default(4.8),
  rescanThreshold: z.coerce
    .number()
    .transform((val) => Math.max(0, Math.min(100, val)))
    .default(95),
  cacheExpireDays: z.coerce
    .number()
    .transform((val) => Math.max(0, val))
    .default(14),
  requestDelayMs: z.coerce
    .number()
    .transform((val) => Math.max(0, val))
    .default(800),
});

export type Settings = z.infer<typeof SettingsSchema>;
