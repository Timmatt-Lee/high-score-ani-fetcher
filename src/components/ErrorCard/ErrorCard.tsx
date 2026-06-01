import { useState } from "react";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperError,
} from "../../errors";
import styles from "./ErrorCard.module.css";

interface ErrorCardProps {
  error: ScraperError;
}

export function ErrorCard({ error }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);

  const getPageNumber = (url?: string) => {
    if (!url) return undefined;
    const match = url.match(/page=(\d+)/);
    return match ? match[1] : undefined;
  };

  const page = getPageNumber(error.url);
  const title = error.title;

  const pageStr = page ? `Page: ${page}` : undefined;
  const suffixStr =
    error instanceof ScraperHttpError
      ? `Status: ${error.status}`
      : error.source !== undefined
        ? `Source: ${error.source}`
        : undefined;

  const cardTitle =
    title ||
    pageStr ||
    (error instanceof ScraperHttpError
      ? "HTTP Error"
      : error instanceof ScraperParseError
        ? "Parser Error"
        : error.name || "Error");
  const cardSubtitle = title
    ? [pageStr, suffixStr].filter(Boolean).join(", ")
    : suffixStr;

  const getFormattedDetails = () => {
    let details = `Error Type: ${error.name}\n`;
    details += `Message: ${error.message}\n`;
    if (error.url) {
      details += `URL: ${error.url}\n`;
    }
    if (error instanceof ScraperHttpError) {
      details += `Status Code: ${error.status}\n`;
    }
    if (error.source) {
      details += `Source Component: ${error.source}\n`;
    }
    if (error.stack) {
      details += `\nStack Trace:\n${error.stack.slice(0, 200)}\n`;
    }
    return details;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedDetails());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // fallback copy
      try {
        const text = error.toString();
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy error details", err);
      }
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
