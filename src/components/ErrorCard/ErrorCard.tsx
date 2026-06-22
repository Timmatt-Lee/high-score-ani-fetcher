import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanError,
  getScanStepLabel,
} from "../../services/animeScanner";
import styles from "./ErrorCard.module.css";

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
  const { title: cardTitle, subtitle: cardSubtitle } =
    getCardTitleAndSubtitle(error);

  const handleCopy = () => {
    const textToCopy = cardSubtitle
      ? `${cardTitle}\n${cardSubtitle}\n${error.message}`
      : `${cardTitle}\n${error.message}`;
    navigator.clipboard.writeText(textToCopy);
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
            title="Copy error details"
            data-testid="error-card-copy-btn"
          >
            Copy
          </button>
          {onDismiss && (
            <button
              className={styles.dismissBtn}
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
