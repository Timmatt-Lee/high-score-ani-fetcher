import { useState } from "react";
import { type AnimeItem } from "../../types/anime";
import { ScraperHttpError, ScraperParseError } from "../../errors";
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

  const getFailedPages = () => {
    const pages = new Set<number>();
    const allErrors = [...httpErrors, ...parseErrors];
    for (const err of allErrors) {
      if (err.url && err.url.includes("animeList.php")) {
        const match = err.url.match(/page=(\d+)/);
        if (match) {
          pages.add(parseInt(match[1], 10));
        }
      }
    }
    return Array.from(pages).sort((a, b) => a - b);
  };
  const failedPages = getFailedPages();
  const totalErrorsCount = httpErrors.length + parseErrors.length;

  if (totalErrorsCount === 0) {
    return null;
  }

  const isRetryDisabled = isScanning || totalErrorsCount === 0;

  const handleRetry = () => {
    onRetry();
  };

  return (
    <div className={styles.errorsPanel} data-testid="errors-panel">
      <div className={styles.summaryBar}>
        <span className={styles.summaryText}>
          {totalErrorsCount} {totalErrorsCount === 1 ? "error" : "errors"}{" "}
          encountered
          {failedPages.length > 0 &&
            ` (Failed Pages: ${failedPages.join(", ")})`}
          {failedDetails.length > 0 &&
            ` (Failed Details: ${failedDetails.length})`}
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
                  <div key={idx} className={styles.errorCard}>
                    <div className={styles.errorTitle}>
                      {err.title ? (
                        <>
                          Anime: <strong>{err.title}</strong> (Status:{" "}
                          <strong>{err.status}</strong>)
                        </>
                      ) : (
                        <>
                          Status: <strong>{err.status}</strong>
                        </>
                      )}
                    </div>
                    <div className={styles.errorUrl}>{err.url}</div>
                    {err.message && (
                      <div className={styles.errorMessage}>{err.message}</div>
                    )}
                  </div>
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
                  <div key={idx} className={styles.errorCard}>
                    <div className={styles.errorTitle}>
                      {err.title ? (
                        <>
                          Anime: <strong>{err.title}</strong> (Component:{" "}
                          <strong>{err.source}</strong>)
                        </>
                      ) : (
                        <>
                          Component: <strong>{err.source}</strong>
                        </>
                      )}
                    </div>
                    <div className={styles.errorUrl}>{err.url}</div>
                    <div className={styles.errorMessage}>
                      {err.message} (
                      {err.html
                        ? err.html.length > 100
                          ? `${err.html.slice(0, 100)}...`
                          : err.html
                        : ""}
                      )
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
