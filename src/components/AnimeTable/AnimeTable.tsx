import { AnimeRow } from "../AnimeRow";
import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeTable.module.css";

interface AnimeTableProps {
  activeTab: Tab;
  list: AnimeItem[];
  sortBy:
    | "title"
    | "score"
    | "watchCount"
    | "uploadDate"
    | "episodeCount"
    | null;
  sortOrder: "asc" | "desc";
  onSort: (
    field: "title" | "score" | "watchCount" | "uploadDate" | "episodeCount",
  ) => void;
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
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
  onRestoreFromTrash,
  targetScore,
}: AnimeTableProps) {
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
        data-tooltip={`Sort by ${label}`}
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

  return (
    <div className={styles.tableWrapper} data-testid="list-container">
      <div className={styles.animeTable}>
        <div className={styles.tableHeader}>
          {renderHeader("Anime Title", "title")}
          {renderHeader("Score", "score")}
          {renderHeader("Views", "watchCount")}
          {renderHeader("Year", "uploadDate")}
          {renderHeader("Episodes", "episodeCount")}
          <div className={styles.actionsHeader}>Actions</div>
        </div>
        <div className={styles.tableBody}>
          {list.map((item) => (
            <AnimeRow
              key={item.link}
              item={item}
              activeTab={activeTab}
              onMoveToFavorites={onMoveToFavorites}
              onMoveToTrash={onMoveToTrash}
              onRestoreFromTrash={onRestoreFromTrash}
              targetScore={targetScore}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
