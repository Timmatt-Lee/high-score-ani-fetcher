import { useState } from "react";
import { type ScraperError } from "../../errors";
import { ErrorCard } from "../ErrorCard/ErrorCard";
import styles from "./ErrorPanel.module.css";

interface ErrorPanelProps {
  title: string;
  errors: ScraperError[];
  emptyMessage: string;
  defaultOpen?: boolean;
  testIdPrefix: string;
}

export function ErrorPanel({
  title,
  errors,
  emptyMessage,
  defaultOpen = false,
  testIdPrefix,
}: ErrorPanelProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
