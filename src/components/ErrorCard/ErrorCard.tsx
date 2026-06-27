import { useState, useEffect } from "react";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanError,
  getScanStepLabel,
} from "../../services/animeScanner";
import styles from "./ErrorCard.module.css";
import { CopyIcon, CheckIcon } from "../Icons";

interface ErrorCardProps {
  error: Error;
  onDismiss?: () => void;
}

const getCardTitleAndSubtitle = (
  error: Error,
): { title: string; subtitle?: string } => {
  if (!(error instanceof AnimeScanError)) {
    return {
      title: error.name || "Error",
      subtitle: undefined,
    };
  }

  const animeName = error.animeName;
  const pageStr = error.page ? `Page: ${error.page}` : undefined;
  const scanStepLabel = getScanStepLabel(error.scanStep);
  const scanStepStr = `When doing: ${scanStepLabel}`;

  const statusCodeStr =
    error instanceof AnimeScanHttpError
      ? `Status Code: ${error.status}`
      : undefined;

  let fallbackTitle = error.name || "Unexpected Error";
  if (error instanceof AnimeScanHttpError) {
    fallbackTitle = "HTTP Error";
  } else if (error instanceof AnimeScanParseError) {
    fallbackTitle = "Parser Error";
  }

  const subtitleParts = [statusCodeStr, scanStepStr];
  if (animeName) {
    subtitleParts.unshift(pageStr);
  }

  return {
    title: animeName || pageStr || fallbackTitle,
    subtitle: subtitleParts.filter(Boolean).join(", "),
  };
};

export function ErrorCard({ error, onDismiss }: ErrorCardProps) {
  const [isCopied, setIsCopied] = useState(false);
  const { title: cardTitle, subtitle: cardSubtitle } =
    getCardTitleAndSubtitle(error);

  useEffect(() => {
    if (!isCopied) return;
    const timer = setTimeout(() => {
      setIsCopied(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, [isCopied]);

  const handleCopy = () => {
    let details = "";
    if (error instanceof AnimeScanError) {
      details += `URL: ${error.url}\n`;
      if (error instanceof AnimeScanHttpError) {
        details += `Status: ${error.status}\n`;
      }
      if (
        error instanceof AnimeScanHttpError ||
        error instanceof AnimeScanParseError
      ) {
        if (error.html) {
          details += `HTML/Body Snippet:\n${error.html}\n`;
        }
      }
    }

    const textToCopy = cardSubtitle
      ? `${cardTitle}\n${cardSubtitle}\n${error.message}\n${details}`.trim()
      : `${cardTitle}\n${error.message}\n${details}`.trim();
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
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
            className={`${styles.iconBtn} ${styles.copyBtn} ${isCopied ? styles.copied : ""}`}
            onClick={handleCopy}
            title={isCopied ? "Copied!" : "Copy error details"}
            data-testid="error-card-copy-btn"
          >
            {isCopied ? (
              <CheckIcon width="14" height="14" />
            ) : (
              <CopyIcon width="14" height="14" />
            )}
          </button>
          {onDismiss && (
            <button
              className={`${styles.iconBtn} ${styles.dismissBtn}`}
              onClick={onDismiss}
              title="Dismiss error"
              aria-label="Dismiss error"
              data-testid="error-card-dismiss-btn"
            >
              ✕
            </button>
          )}
        </div>
      </div>
      <div className={styles.errorMessage} data-testid="error-card-message">
        {error.message}
      </div>
    </div>
  );
}
