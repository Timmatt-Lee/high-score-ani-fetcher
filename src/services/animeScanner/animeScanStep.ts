/**
 * Defines the specific step or field that failed during the scraping process.
 */
export enum AnimeScanStep {
  GET_TOTAL_PAGES = "get_total_pages",
  SCRAPE_LIST_PAGE = "scrape_list_page",
  PARSE_ANIME_INFO = "parse_anime_info",
  PARSE_ANIME_DETAIL = "parse_anime_detail",
}

/**
 * Returns a human-friendly string label describing the scan step.
 */
export function getScanStepLabel(step: AnimeScanStep): string {
  switch (step) {
    case AnimeScanStep.GET_TOTAL_PAGES:
      return "fetching total pages";
    case AnimeScanStep.SCRAPE_LIST_PAGE:
      return "scraping list page";
    case AnimeScanStep.PARSE_ANIME_INFO:
      return "parsing anime info";
    case AnimeScanStep.PARSE_ANIME_DETAIL:
      return "parsing anime detail";
  }
  const _exhaustiveCheck: never = step;
  throw new Error(
    `Unhandled AnimeScanStep: ${JSON.stringify(_exhaustiveCheck)}`,
  );
}
