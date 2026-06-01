import { ScraperParseStep } from "./scraper-parse-step";

/**
 * Base class for all scraper errors.
 */
export abstract class ScraperError extends Error {
  page: number;
  animeName?: string;
  url?: string;

  constructor(message: string, page: number, animeName?: string, url?: string) {
    super(message);
    this.page = page;
    this.animeName = animeName;
    this.url = url;
  }
}

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends ScraperError {
  status: number;
  rawHtml: string;

  constructor(
    page: number,
    url: string,
    rawHtml: string,
    status: number = 500,
    animeName?: string,
  ) {
    super(
      `HTTP request failed with status ${status} (URL: ${url})`,
      page,
      animeName,
      url,
    );
    this.name = "ScraperHttpError";
    this.status = status;
    this.rawHtml = rawHtml;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class ScraperParseError extends ScraperError {
  parseStep: ScraperParseStep;
  rawHtml: string;

  constructor(
    page: number,
    parseStep: ScraperParseStep,
    url: string,
    rawHtml: string,
    message?: string,
    animeName?: string,
  ) {
    super(
      message || `Parsing failed at ${parseStep} (URL: ${url})`,
      page,
      animeName,
      url,
    );
    this.name = "ScraperParseError";
    this.parseStep = parseStep;
    this.rawHtml = rawHtml;
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
