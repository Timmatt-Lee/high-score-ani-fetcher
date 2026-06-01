import { type AnimeItem } from "../../types/anime";
import { type ScraperHttpError, type ScraperParseError } from "../../errors";
import { ErrorPanel } from "../ErrorPanel/ErrorPanel";
import styles from "./ScanErrors.module.css";

interface ScanErrorsProps {
  httpErrors: ScraperHttpError[];
  parseErrors: ScraperParseError[];
  failedDetails: AnimeItem[];
  isScanning: boolean;
  onRetry: () => void;
  defaultHttpOpen?: boolean;
  defaultParseOpen?: boolean;
}

export function ScanErrors({
  httpErrors,
  parseErrors,
  failedDetails,
  isScanning,
  onRetry,
  defaultHttpOpen = false,
  defaultParseOpen = false,
}: ScanErrorsProps) {
  const totalErrorsCount =
    httpErrors.length + parseErrors.length || failedDetails.length;

  if (isScanning || (totalErrorsCount === 0 && failedDetails.length === 0)) {
    return null;
  }

  const isRetryDisabled = isScanning || totalErrorsCount === 0;

  return (
    <div className={styles.scanErrors} data-testid="errors-panel">
      <div className={styles.summaryBar}>
        <span className={styles.summaryText} data-testid="errors-summary-text">
          {totalErrorsCount}{" "}
          {totalErrorsCount === 1 ? "error occurred" : "errors occurred"}
        </span>
        <button
          className={`${styles.btn} ${styles.btnRetry}`}
          onClick={onRetry}
          disabled={isRetryDisabled}
          data-testid="retry-errors-btn"
        >
          Retry Failed Animes
        </button>
      </div>

      <div className={styles.accordion}>
        <ErrorPanel
          title="HTTP Network Errors"
          errors={httpErrors}
          emptyMessage="No network errors."
          defaultOpen={defaultHttpOpen}
          testIdPrefix="http-errors"
        />
        <ErrorPanel
          title="Document Parser Errors"
          errors={parseErrors}
          emptyMessage="No parser errors."
          defaultOpen={defaultParseOpen}
          testIdPrefix="parse-errors"
        />
      </div>
    </div>
  );
}
