import { ScraperErrorSource } from "./scraperErrorSource";

/**
 * Represents failures during HTTP communication with the target site (e.g. status code >= 400).
 */
export class ScraperHttpError extends Error {
  url: string;
  status: number;
  html: string;

  constructor(url: string, html: string, status: number) {
    super(`HTTP request failed with status ${status} (URL: ${url})`);
    this.name = "ScraperHttpError";
    this.url = url;
    this.status = status;
    this.html = html;
  }
}

/**
 * Represents failures when parsing the DOM structure or attributes of a fetched page.
 */
export class ScraperParseError extends Error {
  url: string;
  source: ScraperErrorSource;
  html: string;

  constructor(source: ScraperErrorSource, url: string, html: string) {
    super(`Parsing failed at ${source} (URL: ${url})`);
    this.name = "ScraperParseError";
    this.url = url;
    this.source = source;
    this.html = html;
  }
}
