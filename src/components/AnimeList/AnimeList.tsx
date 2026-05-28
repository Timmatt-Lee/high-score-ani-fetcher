import { AnimeCard } from "../AnimeCard";
import { type AnimeItem } from "../../types/anime";
import { TabType } from "../Tabs";
import styles from "./AnimeList.module.css";

interface AnimeListProps {
  activeTab: TabType;
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
  let list: AnimeItem[] = [];
  if (activeTab === TabType.Search) list = searchList;
  if (activeTab === TabType.Favorites) list = favorites;
  if (activeTab === TabType.Trash) list = trash;

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
