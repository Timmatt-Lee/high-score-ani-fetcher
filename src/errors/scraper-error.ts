import { ScraperErrorSource } from "./scraper-error-source";

/**
 * Base class for all scraper errors.
 */
export class ScraperError extends Error {
  url?: string;
  html?: string;
  title?: string;
  source?: ScraperErrorSource;

  constructor(message: string) {
    super(message);
    this.name = "ScraperError";
  }
}

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends ScraperError {
  status: number;

  constructor(
    url: string,
    html: string,
    status: number = 500,
    title?: string,
    source?: ScraperErrorSource,
  ) {
    super(`HTTP request failed with status ${status} (URL: ${url})`);
    this.name = "ScraperHttpError";
    this.url = url;
    this.status = status;
    this.html = html;
    this.title = title;
    this.source = source;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class ScraperParseError extends ScraperError {
  constructor(
    source: ScraperErrorSource,
    url: string,
    html: string,
    message?: string,
    title?: string,
  ) {
    super(message || `Parsing failed at ${source} (URL: ${url})`);
    this.name = "ScraperParseError";
    this.url = url;
    this.source = source;
    this.html = html;
    this.title = title;
  }
}

/**
 * Represents unexpected runtime errors that occurred during scraping.
 */
export class ScraperUnknownError extends ScraperError {
  constructor(causeError: Error) {
    super(causeError.message);
    this.name = "ScraperUnknownError";
    this.stack = causeError.stack;
  }
}
