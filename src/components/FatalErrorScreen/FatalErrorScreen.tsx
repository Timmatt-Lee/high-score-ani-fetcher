import { useState } from "react";
import { type FatalError } from "../../hooks/useAnimeScanner";
import styles from "./FatalErrorScreen.module.css";

interface FatalErrorScreenProps {
  fatalError: FatalError;
  onDismiss: () => void;
}

export function FatalErrorScreen({
  fatalError,
  onDismiss,
}: FatalErrorScreenProps) {
  const [isCopied, setIsCopied] = useState(false);

  const getFormattedErrorDetails = () => {
    let details = `Error Name: ${fatalError.name}\n`;
    details += `Message: ${fatalError.message}\n`;
    if ("url" in fatalError && fatalError.url) {
      details += `URL: ${fatalError.url}\n`;
    }
    if ("status" in fatalError && fatalError.status !== undefined) {
      details += `Status Code: ${fatalError.status}\n`;
    }
    if ("source" in fatalError && fatalError.source !== undefined) {
      details += `Source Component: ${fatalError.source}\n`;
    }
    if (fatalError.stack) {
      details += `\nStack Trace:\n${fatalError.stack}\n`;
    }
    return details;
  };

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedErrorDetails());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

  return (
    <div className={styles.fatalErrorScreen} data-testid="fatal-error-screen">
      <div className={styles.errorIcon}>❌</div>
      <h2>Something went wrong</h2>
      <p className={styles.errorSubtitle}>
        A fatal error occurred during the scanning process.
      </p>

      <div className={styles.errorBox}>
        <strong>{fatalError.name}</strong>: {fatalError.message}
      </div>

      <div className={styles.errorDetailsHeader}>
        <span>Error Info</span>
        <button
          className={`${styles.btn} ${styles.btnSecondary}`}
          onClick={handleCopyError}
          data-testid="copy-error-btn"
        >
          {isCopied ? "Copied! ✓" : "Copy Error"}
        </button>
      </div>

      <textarea
        className={styles.errorTextArea}
        readOnly
        value={getFormattedErrorDetails()}
        data-testid="error-details-textarea"
      />

      <button
        className={`${styles.btn} ${styles.dismissBtn}`}
        onClick={onDismiss}
        data-testid="dismiss-error-btn"
      >
        Dismiss
      </button>
    </div>
  );
}
