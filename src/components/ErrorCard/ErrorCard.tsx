import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperError,
  ScraperScanStep,
} from "../../services/scraper";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: Error;
}

const getParseStepLabel = (step: ScraperScanStep): string => {
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
  return typeof _exhaustiveCheck === "string" ? _exhaustiveCheck : "parsing";
};

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const animeName = error instanceof ScraperError ? error.animeName : undefined;
  const pageStr =
    (error instanceof ScraperHttpError || error instanceof ScraperParseError) &&
    error.page
      ? `Page: ${error.page}`
      : undefined;
  const scanStepLabel =
    error instanceof ScraperError
      ? getParseStepLabel(error.scanStep)
      : "unknown";

  const suffixStr =
    error instanceof ScraperHttpError
      ? `Status: ${error.status}`
      : `When doing: ${scanStepLabel}`;

  const fallbackTitle =
    error instanceof ScraperHttpError
      ? "HTTP Error"
      : error instanceof ScraperParseError
        ? "Parser Error"
        : error.name || "Error";

  const cardAnimeName = animeName || pageStr || fallbackTitle;
  const cardAnimeSubtitle = animeName
    ? [pageStr, suffixStr].filter(Boolean).join(", ")
    : suffixStr;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error.toString());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

  return (
    <div className={styles.errorCard} data-testid="error-card">
      <div className={styles.cardHeader}>
        <div className={styles.titleGroup}>
          <div className={styles.errorTitle} data-testid="error-card-title">
            {cardAnimeName}
          </div>
          {cardAnimeSubtitle && (
            <div
              className={styles.errorSubtitle}
              data-testid="error-card-subtitle"
            >
              {cardAnimeSubtitle}
            </div>
          )}
        </div>
        <div className={styles.actionGroup}>
          <button
            className={styles.copyBtn}
            onClick={handleCopy}
            data-testid="error-card-copy-btn"
            title="Copy full error details"
          >
            {isCopied ? "Copied! ✓" : "Copy"}
          </button>
        </div>
      </div>

      <div className={styles.errorMessage} data-testid="error-card-message">
        {error.message}
      </div>
    </div>
  );
}
