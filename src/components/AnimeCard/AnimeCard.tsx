import { type AnimeItem } from "../../types/anime";
import styles from "./AnimeCard.module.css";

interface AnimeCardProps {
  item: AnimeItem;
  activeTab: "search" | "favorites" | "trash";
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
}

export function AnimeCard({
  item,
  activeTab,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
}: AnimeCardProps) {
  return (
    <div className={styles.animeCard} data-testid="anime-card">
      <div className={styles.animeTitle}>
        <a href={item.link} target="_blank" rel="noreferrer">
          {item.title}
        </a>
        <span className={styles.scoreBadge}>★ {item.score.toFixed(1)}</span>
      </div>
      <div className={styles.animeMeta}>
        <span>{item.episodeCount} Episodes</span>
        <span>{item.watchCount.toLocaleString()} Views</span>
        <span>
          {isNaN(item.uploadDate.getTime())
            ? "N/A"
            : item.uploadDate.getFullYear()}
        </span>
      </div>
      <div className={styles.animeDesc}>{item.description}</div>

      <div className={styles.cardActions}>
        {activeTab !== "favorites" && activeTab !== "trash" && (
          <button
            className={`${styles.actionBtn} ${styles.fav}`}
            onClick={() => onMoveToFavorites(item)}
          >
            ❤ Favorite
          </button>
        )}
        {activeTab !== "trash" && (
          <button
            className={`${styles.actionBtn} ${styles.trash}`}
            onClick={() => onMoveToTrash(item)}
          >
            🗑 Trash
          </button>
        )}
        {activeTab === "trash" && (
          <button
            className={styles.actionBtn}
            onClick={() => onRestoreFromTrash(item)}
          >
            ↺ Restore
          </button>
        )}
      </div>
    </div>
  );
}
