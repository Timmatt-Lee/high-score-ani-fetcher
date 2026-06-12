/**
 * Defines the specific step or field that failed during the scraping process.
 */
export enum ScraperScanStep {
  GET_TOTAL_PAGES = "get_total_pages",
  SCRAPE_LIST_PAGE = "scrape_list_page",
  PARSE_ANIME_INFO = "parse_anime_info",
  PARSE_ANIME_DETAIL = "parse_anime_detail",
}

/**
 * Returns a human-friendly string label describing the scan step.
 */
export function getScanStepLabel(step: ScraperScanStep): string {
  switch (step) {
    case ScraperScanStep.GET_TOTAL_PAGES:
      return "fetching total pages";
    case ScraperScanStep.SCRAPE_LIST_PAGE:
      return "scraping list page";
    case ScraperScanStep.PARSE_ANIME_INFO:
      return "parsing anime info";
    case ScraperScanStep.PARSE_ANIME_DETAIL:
      return "parsing anime detail";
  }
  const _exhaustiveCheck: never = step;
  throw new Error(
    `Unhandled ScraperScanStep: ${JSON.stringify(_exhaustiveCheck)}`,
  );
}
