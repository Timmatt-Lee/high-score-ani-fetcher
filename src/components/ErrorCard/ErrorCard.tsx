import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperError,
  getScanStepLabel,
} from "../../services/scraper";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: Error;
}

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error.toString());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

  if (!(error instanceof ScraperError)) {
    return (
      <div className={styles.errorCard} data-testid="error-card">
        <div className={styles.cardHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.errorTitle} data-testid="error-card-title">
              {error.name || "Error"}
            </div>
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

  // At this point, error is guaranteed to be a ScraperError
  const animeName = error.animeName;
  const pageStr = error.page ? `Page: ${error.page}` : undefined;
  const scanStepLabel = getScanStepLabel(error.scanStep);

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
