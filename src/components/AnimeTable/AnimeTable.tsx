import { AnimeRow } from "../AnimeRow";
import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeTable.module.css";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useState, useEffect, useRef } from "react";

interface AnimeTableProps {
  activeTab: Tab;
  list: AnimeItem[];
  sortBy:
    "title" | "score" | "watchCount" | "uploadDate" | "episodeCount" | null;
  sortOrder: "asc" | "desc";
  onSort: (
    field: "title" | "score" | "watchCount" | "uploadDate" | "episodeCount",
  ) => void;
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  targetScore?: number;
}

export function AnimeTable({
  activeTab,
  list,
  sortBy,
  sortOrder,
  onSort,
  onMoveToFavorites,
  onMoveToTrash,
  targetScore,
}: AnimeTableProps) {
  const [isSticky, setIsSticky] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Detect when tableHeader is stuck to dynamically toggle the mask corners (isSticky).
  // This is required because we use global window scrolling, which prevents using overflow:hidden
  // on the container. Without a mask, scrolled rows would bleed out of the header's rounded corners.
  useEffect(() => {
    const handleScroll = () => {
      if (headerRef.current) {
        const rect = headerRef.current.getBoundingClientRect();
        // tableHeader is set to top: var(--table-header-top, 60px) in CSS.
        // It sticks at 84px in the app, or 60px fallback.
        // Add a 1px tolerance to detect when it's fully stuck.
        setIsSticky(rect.top <= 85);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Check initial state
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const renderHeader = (
    label: string,
    field: "title" | "score" | "watchCount" | "uploadDate" | "episodeCount",
  ) => {
    const isSorted = sortBy === field;
    return (
      <div
        className={`${styles.sortableHeader} ${isSorted ? styles.sorted : ""}`}
        onClick={() => onSort(field)}
        data-testid={`sort-header-${field}`}
        title={`Sort by ${label}`}
      >
        <span className={styles.headerLabel}>{label}</span>
        {isSorted && (
          <span className={styles.sortIndicator}>
            {sortOrder === "asc" ? "▲" : "▼"}
          </span>
        )}
      </div>
    );
  };

  const virtualizer = useWindowVirtualizer({
    count: list.length,
    estimateSize: () => 88,
    overscan: 20,
    initialRect: { width: 800, height: 800 },
  });

  if (list.length === 0) {
    return (
      <div className={styles.tableWrapper} data-testid="list-container">
        <div className={styles.tableBackdrop} />
        <div className={styles.emptyState}>No anime found in this list.</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper} data-testid="list-container">
      <div className={styles.tableBackdrop} />
      <div className={styles.animeTable}>
        <div
          ref={headerRef}
          className={`${styles.tableHeader} ${isSticky ? styles.isSticky : ""}`}
        >
          {renderHeader("Anime Title", "title")}
          {renderHeader("Score", "score")}
          {renderHeader("Views", "watchCount")}
          {renderHeader("Year", "uploadDate")}
          {renderHeader("EPs", "episodeCount")}
          <div className={styles.actionsHeader}>Add to</div>
        </div>
        <div
          className={styles.tableBody}
          style={{
            height: `${virtualizer.getTotalSize()}px`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = list[virtualRow.index];
            return (
              <div
                key={item.link}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className={styles.virtualRowWrapper}
                style={{
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <AnimeRow
                  item={item}
                  activeTab={activeTab}
                  onMoveToFavorites={onMoveToFavorites}
                  onMoveToTrash={onMoveToTrash}
                  targetScore={targetScore}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
