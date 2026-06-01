import { ScraperErrorSource } from "./scraper-error-source";

/**
 * Base class for all scraper errors.
 */
export class ScraperError extends Error {
  page: number;
  title?: string;
  source?: ScraperErrorSource;
  url?: string;

  constructor(
    message: string,
    page: number,
    title?: string,
    source?: ScraperErrorSource,
    url?: string,
  ) {
    super(message);
    this.name = "ScraperError";
    this.page = page;
    this.title = title;
    this.source = source;
    this.url = url;
  }
}

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends ScraperError {
  status: number;
  html: string;

  constructor(
    page: number,
    url: string,
    html: string,
    status: number = 500,
    title?: string,
    source?: ScraperErrorSource,
  ) {
    super(
      `HTTP request failed with status ${status} (URL: ${url})`,
      page,
      title,
      source,
      url,
    );
    this.name = "ScraperHttpError";
    this.status = status;
    this.html = html;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class ScraperParseError extends ScraperError {
  html: string;

  constructor(
    page: number,
    source: ScraperErrorSource,
    url: string,
    html: string,
    message?: string,
    title?: string,
  ) {
    super(
      message || `Parsing failed at ${source} (URL: ${url})`,
      page,
      title,
      source,
      url,
    );
    this.name = "ScraperParseError";
    this.html = html;
  }
}

/**
 * Represents unexpected runtime errors that occurred during scraping.
 */
export class ScraperUnknownError extends ScraperError {
  constructor(causeError: Error) {
    super(causeError.message, 1);
    this.name = "ScraperUnknownError";
    this.stack = causeError.stack;
  }
}
