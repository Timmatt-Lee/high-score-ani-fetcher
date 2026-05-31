import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: ScraperHttpError | ScraperParseError | ScraperUnknownError;
}

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const getPageNumber = (url?: string) => {
    if (!url) return null;
    const match = url.match(/page=(\d+)/);
    return match ? match[1] : null;
  };

  const page = "url" in error ? getPageNumber(error.url) : null;
  const title = "title" in error ? error.title : undefined;

  let cardTitle: string;
  let cardSubtitle: string | null;

  if ("status" in error && error.status !== undefined) {
    const pageStr = page ? `Page ${page}` : "";
    const statusStr = `Status ${error.status}`;
    const metaParts = [pageStr, statusStr].filter(Boolean).join(" | ");

    if (title) {
      cardTitle = title;
      cardSubtitle = metaParts;
    } else {
      cardTitle = metaParts;
      cardSubtitle = null;
    }
  } else if ("source" in error && error.source !== undefined) {
    const pageStr = page ? `Page ${page}` : "";
    const sourceStr = `Component: ${error.source}`;
    const metaParts = [pageStr, sourceStr].filter(Boolean).join(" | ");

    if (title) {
      cardTitle = title;
      cardSubtitle = metaParts;
    } else {
      cardTitle = metaParts;
      cardSubtitle = null;
    }
  } else {
    cardTitle = error.name || "Fatal Error";
    cardSubtitle = null;
  }

  const getFormattedDetails = () => {
    let details = `Error Type: ${error.name}\n`;
    details += `Message: ${error.message}\n`;
    if ("url" in error && error.url) {
      details += `URL: ${error.url}\n`;
    }
    if ("status" in error && error.status !== undefined) {
      details += `Status Code: ${error.status}\n`;
    }
    if ("source" in error && error.source !== undefined) {
      details += `Source Component: ${error.source}\n`;
    }
    if (error.stack) {
      details += `\nStack Trace:\n${error.stack}\n`;
    }
    return details;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedDetails());
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
