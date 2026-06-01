import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperError,
} from "../../errors";
import { ScraperErrorSource } from "../../errors/scraper-error-source";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: ScraperError;
}

const getSourceLabel = (src?: ScraperErrorSource) => {
  if (src === undefined) return undefined;
  switch (src) {
    case ScraperErrorSource.PAGINATION:
      return "parsing Pagination";
    case ScraperErrorSource.TITLE:
      return "parsing Title";
    case ScraperErrorSource.WATCH_COUNT:
      return "parsing Watch Count";
    case ScraperErrorSource.EPISODE_COUNT:
      return "parsing Episode Count";
    case ScraperErrorSource.UPLOAD_DATE:
      return "parsing Upload Date";
    case ScraperErrorSource.SCORE:
      return "parsing Score";
    case ScraperErrorSource.RATING_COUNT:
      return "parsing Rating Count";
    case ScraperErrorSource.DESCRIPTION:
      return "parsing Description";
    default:
      return "parsing";
  }
};

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const title = error.title;
  const pageStr =
    (error instanceof ScraperHttpError || error instanceof ScraperParseError) &&
    error.page
      ? `Page: ${error.page}`
      : undefined;
  const sourceLabel = getSourceLabel(error.source);

  const suffixStr =
    error instanceof ScraperHttpError
      ? `Status: ${error.status}`
      : sourceLabel
        ? `When doing: ${sourceLabel}`
        : undefined;

  let fallbackTitle = "Error";
  if (error instanceof ScraperHttpError) {
    fallbackTitle = "HTTP Error";
  } else if (error instanceof ScraperParseError) {
    fallbackTitle = "Parser Error";
  } else if (error.name) {
    fallbackTitle = error.name;
  }

  const cardTitle = title || pageStr || fallbackTitle;
  const cardSubtitle = title
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
            {cardTitle}
          </div>
          {cardSubtitle && (
            <div
              className={styles.errorSubtitle}
              data-testid="error-card-subtitle"
            >
              {cardSubtitle}
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
