import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeCard.module.css";
import { HeartIcon, TrashIcon, RestoreIcon } from "../Icons";

interface AnimeCardProps {
  item: AnimeItem;
  activeTab: Tab;
  isDisabled?: boolean;
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
}

export function AnimeCard({
  item,
  activeTab,
  isDisabled = false,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
}: AnimeCardProps) {
  const renderActions = () => {
    switch (activeTab) {
      case Tab.Search:
        return (
          <>
            <button
              className={`${styles.actionBtn} ${styles.fav}`}
              onClick={() => onMoveToFavorites(item)}
              disabled={isDisabled}
            >
              <HeartIcon /> Favorite
            </button>
            <button
              className={`${styles.actionBtn} ${styles.trash}`}
              onClick={() => onMoveToTrash(item)}
              disabled={isDisabled}
            >
              <TrashIcon /> Trash
            </button>
          </>
        );
      case Tab.Favorites:
        return (
          <button
            className={`${styles.actionBtn} ${styles.trash}`}
            onClick={() => onMoveToTrash(item)}
            disabled={isDisabled}
          >
            <TrashIcon /> Trash
          </button>
        );
      case Tab.Trash:
        return (
          <button
            className={styles.actionBtn}
            onClick={() => onRestoreFromTrash(item)}
            disabled={isDisabled}
          >
            <RestoreIcon /> Restore
          </button>
        );
      case Tab.Settings:
        return null;
      default: {
        const _exhaustiveCheck: never = activeTab;
        throw new Error(`Unhandled activeTab state: ${_exhaustiveCheck}`);
      }
    }
  };

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

      <div className={styles.cardActions}>{renderActions()}</div>
    </div>
  );
}
