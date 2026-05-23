import { ScraperHttpError, ScraperParseError } from "../errors";
import { type Result } from "./result";

export interface AnimeDetails {
  score: number;
  ratingCount: number;
  description: string;
}

export interface AnimeItem extends AnimeDetails {
  link: string;
  title: string;
  watchCount: number;
  episodeCount: number;
  uploadDate: Date;
}

export interface ScrapeListResult {
  items: AnimeItem[];
  errors: (ScraperHttpError | ScraperParseError)[];
}

export interface ScanResult {
  items: AnimeItem[];
  errors: (ScraperHttpError | ScraperParseError)[];
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
  scrapeListPage(pageNum: number): Promise<ScrapeListResult>;
  scrapeAnimeDetails(
    link: string,
  ): Promise<Result<AnimeDetails, ScraperHttpError | ScraperParseError>>;
}
