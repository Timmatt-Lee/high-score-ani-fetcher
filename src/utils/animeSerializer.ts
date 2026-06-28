import { z } from "zod";
import { type AnimeItem, AnimeItemSchema } from "../services/animeScanner";

/**
 * Serializes a list of AnimeItem objects into a plain JSON-serializable format.
 * Converts Date instances to ISO strings.
 */
export function serializeAnimeList(list: AnimeItem[]) {
  return list.map((item) => ({
    ...item,
    uploadDate: item.uploadDate.toISOString(),
    scannedAt:
      item.scannedAt instanceof Date
        ? item.scannedAt.toISOString()
        : item.scannedAt,
  }));
}

/**
 * Parses and validates raw list data into a verified array of AnimeItem objects.
 * Coerces date strings back into Date instances.
 * Throws an error if validation fails.
 */
export function parseAnimeList(listData: unknown): AnimeItem[] {
  const schemaResult = z.array(AnimeItemSchema).safeParse(listData);
  if (!schemaResult.success) {
    throw new Error("Data schema validation failed");
  }
  return schemaResult.data.map((item) => ({
    ...item,
    uploadDate: new Date(item.uploadDate),
    scannedAt: item.scannedAt ? new Date(item.scannedAt) : undefined,
  }));
}
