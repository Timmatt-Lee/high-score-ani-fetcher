import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeRow.module.css";
import { HeartIcon, TrashIcon, RestoreIcon } from "../Icons";

interface AnimeRowProps {
  item: AnimeItem;
  isDisabled?: boolean;
  activeTab: Tab;
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
}

export function AnimeRow({
  item,
  isDisabled,
  activeTab,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
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
            disabled={isDisabled}
            className={`${styles.actionBtn} ${styles.fav}`}
            onClick={() => onRestoreFromTrash(item)}
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

  const uploadYear =
    item.uploadDate instanceof Date && !isNaN(item.uploadDate.getTime())
      ? item.uploadDate.getFullYear().toString()
      : "N/A";

  return (
    <tr className={styles.animeRow} data-testid="anime-card">
      <td className={styles.titleCell}>
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
      </td>
      <td className={styles.scoreCell}>
        <span className={styles.scoreBadge}>★ {item.score.toFixed(1)}</span>
      </td>
      <td className={styles.viewsCell}>{item.watchCount.toLocaleString()}</td>
      <td className={styles.yearCell}>{uploadYear}</td>
      <td className={styles.episodesCell}>{item.episodeCount} Episodes</td>
      <td className={styles.actionsCell}>
        <div className={styles.rowActions}>{renderActions()}</div>
      </td>
    </tr>
  );
}
