import { ScraperErrorSource } from "./scraper-error-source";

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends Error {
  url: string;
  status: number;
  html: string;

  constructor(url: string, html: string, status: number = 500) {
    super(`HTTP request failed with status ${status} (URL: ${url})`);
    this.name = "ScraperHttpError";
    this.url = url;
    this.status = status;
    this.html = html;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class ScraperParseError extends Error {
  url: string;
  source: ScraperErrorSource;
  html: string;

  constructor(
    source: ScraperErrorSource,
    url: string,
    html: string,
    message?: string,
  ) {
    super(message || `Parsing failed at ${source} (URL: ${url})`);
    this.name = "ScraperParseError";
    this.url = url;
    this.source = source;
    this.html = html;
  }
}

/**
 * Represents unexpected runtime errors that occurred during scraping.
 */
export class ScraperUnknownError extends Error {
  causeError: Error;

  constructor(causeError: Error) {
    super(causeError.message);
    this.name = "ScraperUnknownError";
    this.causeError = causeError;
  }
}
