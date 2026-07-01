import { AnimeScanStep } from "./animeScanStep";

/**
 * Base class for all scanner errors.
 */
export abstract class AnimeScanError extends Error {
  page: number;
  scanStep: AnimeScanStep;
  url: string;
  animeName?: string;

  constructor(
    message: string,
    page: number,
    scanStep: AnimeScanStep,
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
export class AnimeScanHttpError extends AnimeScanError {
  status: number;
  html: string;

  constructor(
    page: number,
    scanStep: AnimeScanStep,
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
    this.name = "AnimeScanHttpError";
    this.status = status;
    this.html = html;
  }
}

/**
 * Represents failures during document parsing (e.g. missing elements, malformed text).
 */
export class AnimeScanParseError extends AnimeScanError {
  html: string;

  constructor(
    page: number,
    scanStep: AnimeScanStep,
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
    this.name = "AnimeScanParseError";
    this.html = html;
  }
}
