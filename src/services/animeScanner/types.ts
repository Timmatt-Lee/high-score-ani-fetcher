import { z } from "zod";

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
