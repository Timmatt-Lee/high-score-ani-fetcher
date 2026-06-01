import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperError,
} from "../../errors";
import { ScraperParseStep } from "../../errors/scraper-parse-step";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: ScraperError;
}

const getParseStepLabel = (step: ScraperParseStep) => {
  switch (step) {
    case ScraperParseStep.PAGINATION:
      return "parsing Pagination";
    case ScraperParseStep.TITLE:
      return "parsing Title";
    case ScraperParseStep.WATCH_COUNT:
      return "parsing Watch Count";
    case ScraperParseStep.EPISODE_COUNT:
      return "parsing Episode Count";
    case ScraperParseStep.UPLOAD_DATE:
      return "parsing Upload Date";
    case ScraperParseStep.SCORE:
      return "parsing Score";
    case ScraperParseStep.RATING_COUNT:
      return "parsing Rating Count";
    case ScraperParseStep.DESCRIPTION:
      return "parsing Description";
    default:
      return "parsing";
  }
};

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const animeName = error.animeName;
  const pageStr =
    (error instanceof ScraperHttpError || error instanceof ScraperParseError) &&
    error.page
      ? `Page: ${error.page}`
      : undefined;
  const parseStepLabel =
    error instanceof ScraperParseError
      ? getParseStepLabel(error.parseStep)
      : undefined;

  const suffixStr =
    error instanceof ScraperHttpError
      ? `Status: ${error.status}`
      : parseStepLabel
        ? `When doing: ${parseStepLabel}`
        : undefined;

  const fallbackTitle =
    error instanceof ScraperHttpError
      ? "HTTP Error"
      : error instanceof ScraperParseError
        ? "Parser Error"
        : error.name;

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
