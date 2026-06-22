import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeRow.module.css";
import { HeartIcon, TrashIcon } from "../Icons";

function formatViews(views: number): string {
  if (views >= 1_000_000) {
    return (views / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (views >= 1_000) {
    return (views / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return views.toString();
}

interface AnimeRowProps {
  item: AnimeItem;
  isDisabled?: boolean;
  activeTab: Tab;
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
  targetScore?: number;
}

export function AnimeRow({
  item,
  isDisabled,
  activeTab,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
  targetScore = 4.8,
}: AnimeRowProps) {
  const renderActions = () => {
    switch (activeTab) {
      case Tab.Search:
        return (
          <>
            <button
              className={`${styles.actionBtn} ${styles.fav}`}
              onClick={() => onMoveToFavorites(item)}
              disabled={isDisabled}
              aria-label="Add to Favorites"
              title="Add to Favorites"
              data-tooltip="Add to Favorites"
            >
              <HeartIcon width="18" height="18" />
            </button>
            <button
              className={`${styles.actionBtn} ${styles.trash}`}
              onClick={() => onMoveToTrash(item)}
              disabled={isDisabled}
              aria-label="Move to Trash"
              title="Move to Trash"
              data-tooltip="Move to Trash"
            >
              <TrashIcon width="18" height="18" />
            </button>
          </>
        );
      case Tab.Favorites:
        return (
          <button
            className={`${styles.actionBtn} ${styles.trash}`}
            onClick={() => onMoveToTrash(item)}
            disabled={isDisabled}
            aria-label="Move to Trash"
            title="Move to Trash"
            data-tooltip="Move to Trash"
          >
            <TrashIcon width="18" height="18" />
          </button>
        );
      case Tab.Trash:
        return (
          <button
            disabled={isDisabled}
            className={`${styles.actionBtn} ${styles.fav}`}
            onClick={() => onRestoreFromTrash(item)}
            aria-label="Restore to Favorites"
            title="Restore to Favorites"
            data-tooltip="Restore to Favorites"
          >
            <HeartIcon width="18" height="18" />
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

  const getScoreClass = (score: number) => {
    const maxScore = 5.0;
    const range = maxScore - targetScore;
    if (range <= 0) {
      return styles.scoreExcellent;
    }
    const step = range / 3;
    if (score >= targetScore + 2 * step) {
      return styles.scoreExcellent;
    }
    if (score >= targetScore + step) {
      return styles.scoreGood;
    }
    return styles.scoreAverage;
  };

  const uploadYear =
    item.uploadDate instanceof Date && !isNaN(item.uploadDate.getTime())
      ? item.uploadDate.getUTCFullYear().toString()
      : "N/A";

  return (
    <div className={styles.animeRow} data-testid="anime-card">
      <div className={styles.titleCell}>
        <div className={styles.titleWrapper}>
          <a
            href={item.link}
            target="_blank"
            rel="noreferrer"
            className={styles.titleLink}
          >
            {item.title}
          </a>
          <span className={styles.descriptionText}>{item.description}</span>
        </div>
      </div>
      <div className={styles.scoreCell}>
        <span className={`${styles.scoreBadge} ${getScoreClass(item.score)}`}>
          ★ {item.score.toFixed(1)}
        </span>
      </div>
      <div className={styles.viewsCell}>{formatViews(item.watchCount)}</div>
      <div className={styles.yearCell}>{uploadYear}</div>
      <div className={styles.episodesCell}>{item.episodeCount}</div>
      <div className={styles.actionsCell}>
        <div className={styles.rowActions}>{renderActions()}</div>
      </div>
    </div>
  );
}
