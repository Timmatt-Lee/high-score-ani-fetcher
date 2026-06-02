/**
 * Defines the specific step or field that failed during the scraping process.
 */
export enum ScraperScanStep {
  GET_TOTAL_PAGES = "get_total_pages",
  SCRAPE_LIST_PAGE = "scrape_list_page",
  PARSE_ANIME_INFO = "parse_anime_info",
  PARSE_ANIME_DETAIL = "parse_anime_detail",
}
