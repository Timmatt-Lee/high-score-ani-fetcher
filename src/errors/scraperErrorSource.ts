/**
 * Defines the specific source or field that failed during document parsing.
 */
export const ScraperErrorSource = {
  PAGINATION: "PAGINATION",
  TITLE: "TITLE",
  WATCH_COUNT: "WATCH_COUNT",
  EPISODE_COUNT: "EPISODE_COUNT",
  UPLOAD_DATE: "UPLOAD_DATE",
  SCORE: "SCORE",
  RATING_COUNT: "RATING_COUNT",
  DESCRIPTION: "DESCRIPTION",
} as const;

export type ScraperErrorSource =
  (typeof ScraperErrorSource)[keyof typeof ScraperErrorSource];
