import { ScraperScanStep } from "./scraper-scan-step";

/**
 * Base class for all scraper errors.
 */
export abstract class ScraperError extends Error {
  page: number;
  scanStep: ScraperScanStep;
  url: string;
  animeName?: string;

  constructor(
    message: string,
    page: number,
    scanStep: ScraperScanStep,
    url: string,
    animeName?: string,
  ) {
    super(message);
    this.page = page;
    this.scanStep = scanStep;
    this.url = url;
    this.animeName = animeName;
  }
}

/**
 * Represents communication failures with the target site, such as receiving non-2xx/3xx HTTP response status codes (e.g., 404, 500, 502).
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
    scanStep: ScraperScanStep = ScraperScanStep.PAGINATION,
  ) {
    super(
      `HTTP request failed with status ${status} (URL: ${url})`,
      page,
      scanStep,
      url,
      animeName,
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
  rawHtml: string;

  constructor(
    page: number,
    scanStep: ScraperScanStep,
    url: string,
    rawHtml: string,
    message?: string,
    animeName?: string,
  ) {
    super(
      message || `Parsing failed at ${scanStep} (URL: ${url})`,
      page,
      scanStep,
      url,
      animeName,
    );
    this.name = "ScraperParseError";
    this.rawHtml = rawHtml;
  }
}

/**
 * Represents unexpected runtime errors that occurred during scraping.
 */
export class ScraperUnknownError extends ScraperError {
  constructor(causeError: Error) {
    super(causeError.message, 1, ScraperScanStep.SYSTEM, "unknown");
    this.name = "ScraperUnknownError";
    this.stack = causeError.stack;
  }
}
