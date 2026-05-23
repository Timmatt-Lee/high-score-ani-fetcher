import { ScraperHttpError, ScraperParseError } from "../errors";

export interface AnimeDetails {
  score: number;
  rating_count: number;
  description: string;
}

export interface AnimeItem extends AnimeDetails {
  link: string;
  title: string;
  watch_count: number;
  episode_count: number;
  upload_date: Date;
}

export interface ScrapeListResult {
  items: AnimeItem[];
  parseErrors: ScraperParseError[];
}

export interface ScanResult extends ScrapeListResult {
  httpErrors: ScraperHttpError[];
}

export interface AnimeScraper {
  scrapeListPage(pageNum: number): Promise<ScrapeListResult>;
  scrapeAnimeDetails(link: string): Promise<AnimeDetails>;
}

export type ScanProgressCallback = (
  pagesCompleted: number,
  pagesTotal: number,
  detailsCompleted: number,
  detailsTotal: number,
  currentTitle: string,
) => void;
