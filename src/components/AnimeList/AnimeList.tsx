import { AnimeCard } from "../AnimeCard";
import { type AnimeItem } from "../../types/anime";
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
}

export function AnimeList({
  activeTab,
  searchList,
  favoriteList,
  trashList,
  onMoveToFavorites,
  onMoveToTrash,
  onRestoreFromTrash,
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
    case Tab.Errors:
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
    <div className={styles.listContainer} data-testid="list-container">
      {list.map((item) => (
        <AnimeCard
          key={item.link}
          item={item}
          activeTab={activeTab}
          onMoveToFavorites={onMoveToFavorites}
          onMoveToTrash={onMoveToTrash}
          onRestoreFromTrash={onRestoreFromTrash}
        />
      ))}
    </div>
  );
}
