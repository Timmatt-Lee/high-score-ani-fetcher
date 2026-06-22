import { useState } from "react";
import styles from "./ResultBanner.module.css";

interface ResultBannerProps {
  successCount: number;
  addedCount: number;
  refetchedCount: number;
  skippedCachedCount: number;
  failedCount: number;
  onDismiss?: () => void;
}

type HoverableChip = "success" | "added" | "updated" | "skip" | "fail" | null;

export function ResultBanner({
  successCount,
  addedCount,
  refetchedCount,
  skippedCachedCount,
  failedCount,
  onDismiss,
}: ResultBannerProps) {
  const [hoveredChip, setHoveredChip] = useState<HoverableChip>(null);

  // Helper to check if a chip is expanded (either directly hovered, or no chip is hovered and it defaults to compact)
  const isExpanded = (chip: HoverableChip) => hoveredChip === chip;
  return (
    <div className={styles.bannerContainer} data-testid="scan-stats-container">
      <div className={styles.bannerContent}>
        {/* Success Group (Success, Added, Updated) */}
        <div className={styles.group} data-group="success">
          <div
            className={`${styles.chip} ${styles.chipSuccess} ${
              isExpanded("success") ? styles.expanded : styles.collapsed
            }`}
            onMouseEnter={() => setHoveredChip("success")}
            onMouseLeave={() => setHoveredChip(null)}
            data-testid="chip-success"
            title="Total successfully scanned anime"
            data-tooltip="Total successfully scanned anime"
          >
            <span className={styles.icon}>✓</span>
            <span className={styles.label}>
              {isExpanded("success") ? `success ${successCount}` : successCount}
            </span>
          </div>

          <div
            className={`${styles.chip} ${styles.chipAdded} ${
              isExpanded("added") ? styles.expanded : styles.collapsed
            }`}
            onMouseEnter={() => setHoveredChip("added")}
            onMouseLeave={() => setHoveredChip(null)}
            data-testid="chip-added"
            title="Newly added anime to the list"
            data-tooltip="Newly added anime to the list"
          >
            <span className={styles.icon}>+</span>
            <span className={styles.label}>
              {isExpanded("added") ? `new ${addedCount}` : addedCount}
            </span>
          </div>

          <div
            className={`${styles.chip} ${styles.chipUpdated} ${
              isExpanded("updated") ? styles.expanded : styles.collapsed
            }`}
            onMouseEnter={() => setHoveredChip("updated")}
            onMouseLeave={() => setHoveredChip(null)}
            data-testid="chip-updated"
            title="Existing anime updated with fresh details"
            data-tooltip="Existing anime updated with fresh details"
          >
            <span className={styles.icon}>✎</span>
            <span className={styles.label}>
              {isExpanded("updated")
                ? `update ${refetchedCount}`
                : refetchedCount}
            </span>
          </div>
        </div>

        {/* Skip Group (Cached) */}
        <div className={styles.group} data-group="skip">
          <div
            className={`${styles.chip} ${styles.chipSkip} ${
              isExpanded("skip") ? styles.expanded : styles.collapsed
            }`}
            onMouseEnter={() => setHoveredChip("skip")}
            onMouseLeave={() => setHoveredChip(null)}
            data-testid="chip-skip"
            title="Skipped anime with valid cached details"
            data-tooltip="Skipped anime with valid cached details"
          >
            <span className={styles.icon}>⧗</span>
            <span className={styles.label}>
              {isExpanded("skip")
                ? `skip ${skippedCachedCount}`
                : skippedCachedCount}
            </span>
          </div>
        </div>

        {/* Fail Group (Failed) */}
        <div className={styles.group} data-group="fail">
          <div
            className={`${styles.chip} ${styles.chipFail} ${
              isExpanded("fail") ? styles.expanded : styles.collapsed
            }`}
            onMouseEnter={() => setHoveredChip("fail")}
            onMouseLeave={() => setHoveredChip(null)}
            data-testid="chip-fail"
            title="Failed requests or parser errors"
            data-tooltip="Failed requests or parser errors"
          >
            <span className={styles.icon}>⚠</span>
            <span className={styles.label}>
              {isExpanded("fail") ? `fail ${failedCount}` : failedCount}
            </span>
          </div>
        </div>
      </div>

      {onDismiss && (
        <button
          className={styles.dismissBtn}
          onClick={onDismiss}
          aria-label="Dismiss scan results"
          title="Dismiss Results"
          data-tooltip="Dismiss Results"
          data-tooltip-dir="bottom"
        >
          ✕
        </button>
      )}
    </div>
  );
}
