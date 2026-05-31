import { useState } from "react";
import { type AnimeItem } from "../../types/anime";
import { ScraperHttpError, ScraperParseError } from "../../errors";
import { ErrorCard } from "../ErrorCard/ErrorCard";
import styles from "./ErrorsPanel.module.css";

interface ErrorsPanelProps {
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
  failedDetails: AnimeItem[];
  isScanning: boolean;
  onRetry: () => void;
}

export function ErrorsPanel({
  httpErrors,
  parseErrors,
  failedDetails,
  isScanning,
  onRetry,
}: ErrorsPanelProps) {
  const [isHttpOpen, setIsHttpOpen] = useState(true);
  const [isParseOpen, setIsParseOpen] = useState(true);

  const totalErrorsCount =
    httpErrors.length + parseErrors.length || failedDetails.length;

  if (totalErrorsCount === 0 && failedDetails.length === 0) {
    return null;
  }

  const isRetryDisabled = isScanning || totalErrorsCount === 0;

  const handleRetry = () => {
    onRetry();
  };

  return (
    <div className={styles.errorsPanel} data-testid="errors-panel">
      <div className={styles.summaryBar}>
        <span className={styles.summaryText} data-testid="errors-summary-text">
          {totalErrorsCount}{" "}
          {totalErrorsCount === 1 ? "error occurred" : "errors occurred"}
        </span>
        <button
          className={`${styles.btn} ${styles.btnRetry}`}
          onClick={handleRetry}
          disabled={isRetryDisabled}
          data-testid="retry-errors-btn"
        >
          {isScanning ? "Retrying..." : "Retry Failed Items"}
        </button>
      </div>

      <div className={styles.accordion}>
        {/* HTTP Errors Group */}
        <div
          className={`${styles.accordionItem} ${isHttpOpen ? styles.open : ""}`}
          data-testid="http-errors-group"
        >
          <div
            className={styles.accordionHeader}
            onClick={() => setIsHttpOpen(!isHttpOpen)}
            data-testid="http-errors-header"
          >
            <span>HTTP Network Errors ({httpErrors.length})</span>
            <span className={styles.arrow}>{isHttpOpen ? "▲" : "▼"}</span>
          </div>
          <div className={styles.accordionContent}>
            {httpErrors.length === 0 ? (
              <div className={styles.emptyGroup}>No network errors.</div>
            ) : (
              <div className={styles.errorList}>
                {httpErrors.map((err, idx) => (
                  <ErrorCard key={idx} error={err} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Parser Errors Group */}
        <div
          className={`${styles.accordionItem} ${isParseOpen ? styles.open : ""}`}
          data-testid="parse-errors-group"
        >
          <div
            className={styles.accordionHeader}
            onClick={() => setIsParseOpen(!isParseOpen)}
            data-testid="parse-errors-header"
          >
            <span>Document Parser Errors ({parseErrors.length})</span>
            <span className={styles.arrow}>{isParseOpen ? "▲" : "▼"}</span>
          </div>
          <div className={styles.accordionContent}>
            {parseErrors.length === 0 ? (
              <div className={styles.emptyGroup}>No parser errors.</div>
            ) : (
              <div className={styles.errorList}>
                {parseErrors.map((err, idx) => (
                  <ErrorCard key={idx} error={err} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
