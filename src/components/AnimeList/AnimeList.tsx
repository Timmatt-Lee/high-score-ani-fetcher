import { AnimeCard } from "../AnimeCard";
import { type AnimeItem } from "../../types/anime";
import { Tab } from "../Tabs";
import styles from "./AnimeList.module.css";

interface AnimeListProps {
  activeTab: Tab;
  searchList: AnimeItem[];
  favorites: AnimeItem[];
  trash: AnimeItem[];
  onMoveToFavorites: (item: AnimeItem) => void;
  onMoveToTrash: (item: AnimeItem) => void;
  onRestoreFromTrash: (item: AnimeItem) => void;
}

export function AnimeList({
  activeTab,
  searchList,
  favorites,
  trash,
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
      list = favorites;
      break;
    case Tab.Trash:
      list = trash;
      break;
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
