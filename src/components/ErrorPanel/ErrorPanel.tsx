import { useState } from "react";
import { AnimeScanError } from "../../services/animeScanner";
import { ErrorCard } from "../ErrorCard/ErrorCard";
import styles from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  title: string;
  testIdPrefix: string;
  emptyMessage?: string;
  errors: AnimeScanError[];
  isExpandedByDefault?: boolean;
}

export function ErrorPanel({
  title,
  testIdPrefix,
  emptyMessage = "No errors.",
  errors,
  isExpandedByDefault = false,
}: ErrorPanelProps) {
  const [isOpen, setIsOpen] = useState(isExpandedByDefault);

  return (
    <div
      className={`${styles.accordionItem} ${isOpen ? styles.open : ""} ${errors.length > 0 ? styles.hasErrors : ""}`}
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
