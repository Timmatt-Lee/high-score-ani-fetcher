import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../../errors";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: ScraperHttpError | ScraperParseError | ScraperUnknownError;
  onDismiss?: () => void;
}

export function ErrorCard({ error, onDismiss }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const getPageNumber = (url?: string) => {
    if (!url) return null;
    const match = url.match(/page=(\d+)/);
    return match ? match[1] : null;
  };

  const page = "url" in error ? getPageNumber(error.url) : null;
  const title = "title" in error ? error.title : undefined;

  let cardTitle: string;
  if ("status" in error && error.status !== undefined) {
    if (title) {
      const pageStr = page ? `(Page: ${page})` : "";
      cardTitle = `${title} ${pageStr}(Status: ${error.status})`
        .replace(/\s+/g, " ")
        .trim();
    } else {
      const pageStr = page ? `Page: ${page} ` : "";
      cardTitle = `${pageStr}(Status: ${error.status})`.trim();
    }
  } else if ("source" in error && error.source !== undefined) {
    if (title) {
      const pageStr = page ? `(Page: ${page})` : "";
      cardTitle = `${title} ${pageStr}`.trim();
    } else {
      cardTitle = page ? `Page: ${page}` : `Parser Error (${error.source})`;
    }
  } else {
    cardTitle = error.name || "Fatal Error";
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
        <div className={styles.errorTitle} data-testid="error-card-title">
          ⚠️ {cardTitle}
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
          {onDismiss && (
            <button
              className={styles.dismissBtn}
              onClick={onDismiss}
              data-testid="error-card-dismiss-btn"
              title="Dismiss error"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      <div className={styles.errorMessage} data-testid="error-card-message">
        {error.message}
      </div>

      {"source" in error && error.source && (
        <div className={styles.errorMeta}>
          Component: <strong>{error.source}</strong>
        </div>
      )}
    </div>
  );
}
