/**
 * Custom error class representing failure during the scraping process.
 * Captures relevant contextual information such as the source URL, HTTP status code,
 * and a snippet of HTML from the page structure at the time of failure.
 */
export class ScraperError extends Error {
  url: string;
  status?: number;
  htmlSnippet?: string;

  constructor(
    message: string,
    url: string,
    status?: number,
    htmlSnippet?: string,
  ) {
    super(`${message} (URL: ${url}${status ? `, Status: ${status}` : ""})`);
    this.name = "ScraperError";
    this.url = url;
    this.status = status;
    this.htmlSnippet = htmlSnippet;
  }
}
