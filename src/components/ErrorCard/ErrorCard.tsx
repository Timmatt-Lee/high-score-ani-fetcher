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

  // Compute card Title and Subtitle dynamically based on Error instance type
  let cardTitle: string;
  let cardSubtitle: string | undefined;

  if (error instanceof ScraperError) {
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

    cardTitle = animeName || pageStr || fallbackTitle;
    cardSubtitle = animeName
      ? [pageStr, suffixStr].filter(Boolean).join(", ")
      : suffixStr;
  } else {
    cardTitle = error.name || "Error";
    cardSubtitle = undefined;
  }

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
