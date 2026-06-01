import { ScraperErrorSource } from "./scraper-error-source";

/**
 * Base class for all scraper errors.
 */
export abstract class ScraperError extends Error {
  page: number;
  title?: string;

  constructor(message: string, page: number, title?: string) {
    super(message);
    this.page = page;
    this.title = title;
  }
}

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends ScraperError {
  url: string;
  status: number;
  html: string;

  constructor(
    page: number,
    url: string,
    html: string,
    status: number = 500,
    title?: string,
  ) {
    super(
      `HTTP request failed with status ${status} (URL: ${url})`,
      page,
      title,
    );
    this.name = "ScraperHttpError";
    this.url = url;
    this.status = status;
    this.html = html;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class ScraperParseError extends ScraperError {
  source: ScraperErrorSource;
  url: string;
  html: string;

  constructor(
    page: number,
    source: ScraperErrorSource,
    url: string,
    html: string,
    message?: string,
    title?: string,
  ) {
    super(message || `Parsing failed at ${source} (URL: ${url})`, page, title);
    this.name = "ScraperParseError";
    this.source = source;
    this.url = url;
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
