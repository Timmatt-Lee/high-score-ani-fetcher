import { AnimeTable } from "../AnimeTable";
import { type AnimeItem } from "../../services/animeScanner";
import { Tab } from "../Tabs";
import styles from "./AnimeList.module.css";

interface AnimeListProps {
  activeTab: Tab;
  searchList: AnimeItem[];
  favoriteList: AnimeItem[];
  trashList: AnimeItem[];
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
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
  targetScore?: number;
}

export function AnimeList({
  activeTab,
  searchList,
  favoriteList,
  trashList,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
  sortBy,
  sortOrder,
  onSort,
  targetScore,
}: AnimeListProps) {
  let list: AnimeItem[];
  switch (activeTab) {
    case Tab.Search:
      list = searchList;
      break;
    case Tab.Favorites:
      list = favoriteList;
      break;
    case Tab.Trash:
      list = trashList;
      break;
    case Tab.Settings:
      return null;
    default: {
      const _exhaustiveCheck: never = activeTab;
      throw new Error(`Unhandled activeTab state: ${_exhaustiveCheck}`);
    }
  }

  if (list.length === 0) {
    return (
      <div className={styles.emptyState} data-testid="list-container">
        No anime found in this list.
      </div>
    );
  }

  return (
    <AnimeTable
      activeTab={activeTab}
      list={list}
      sortBy={sortBy}
      sortOrder={sortOrder}
      onSort={onSort}
      onMoveToFavorites={onMoveToFavorites}
      onMoveToTrash={onMoveToTrash}
      onRestoreFromTrash={onRestoreFromTrash}
      targetScore={targetScore}
    />
  );
}
