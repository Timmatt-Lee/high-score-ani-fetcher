import { useState } from "react";
import {
  AnimeScanError,
  AnimeScanHttpError,
  AnimeScanParseError,
} from "../../services/animeScanner";
import { ErrorCard } from "../ErrorCard/ErrorCard";
import styles from "./ErrorPanel.module.css";

interface ErrorPanelProps<E extends AnimeScanError> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errorClass: { new (...args: any[]): E };
  errors: E[];
  isExpandedByDefault?: boolean;
}

export function ErrorPanel<E extends AnimeScanError>({
  errorClass,
  errors,
  isExpandedByDefault = false,
}: ErrorPanelProps<E>) {
  const [isOpen, setIsOpen] = useState(isExpandedByDefault);

  let title = "Errors";
  let emptyMessage = "No errors found.";
  let testIdPrefix = "errors";

  if ((errorClass as unknown) === AnimeScanHttpError) {
    title = "HTTP Network Errors";
    emptyMessage = "No network errors.";
    testIdPrefix = "http-errors";
  } else if ((errorClass as unknown) === AnimeScanParseError) {
    title = "Document Parser Errors";
    emptyMessage = "No parser errors.";
    testIdPrefix = "parse-errors";
  }

  return (
    <div
      className={`${styles.accordionItem} ${isOpen ? styles.open : ""}`}
      data-testid={`${testIdPrefix}-group`}
    >
      <div
        className={styles.accordionHeader}
        onClick={() => setIsOpen(!isOpen)}
        data-testid={`${testIdPrefix}-header`}
      >
        <span>
          {title} ({errors.length})
        </span>
        <span className={styles.arrow}>{isOpen ? "▲" : "▼"}</span>
      </div>
      <div className={styles.accordionContent}>
        {errors.length === 0 ? (
          <div className={styles.emptyGroup}>{emptyMessage}</div>
        ) : (
          <div className={styles.errorList}>
            {errors.map((err, idx) => (
              <ErrorCard key={idx} error={err} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
