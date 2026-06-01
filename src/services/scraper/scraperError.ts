import { ScraperScanStep } from "./scraperScanStep";

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
  html: string;

  constructor(
    page: number,
    scanStep: ScraperScanStep,
    url: string,
    html: string,
    status: number,
    animeName?: string,
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
    scanStep: ScraperScanStep,
    url: string,
    html: string,
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
    this.html = html;
  }
}

/**
 * Represents unexpected runtime errors that occurred during scraping.
 */
export class ScraperUnknownError extends ScraperError {
  constructor(
    causeError: Error,
    page: number,
    scanStep: ScraperScanStep,
    url: string,
    animeName?: string,
  ) {
    super(causeError.message, page, scanStep, url, animeName);
    this.name = "ScraperUnknownError";
    this.stack = causeError.stack;
  }
}
