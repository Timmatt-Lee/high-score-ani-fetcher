import { AnimeCard } from "./AnimeCard";
import { type AnimeItem } from "../services/scraper";
import styles from "./AnimeList.module.css";

interface AnimeListProps {
  activeTab: "search" | "favorites" | "trash";
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
  if (activeTab === "search") list = searchList;
  if (activeTab === "favorites") list = favorites;
  if (activeTab === "trash") list = trash;

  if (list.length === 0) {
    return (
      <div className={styles.emptyState}>No anime found in this list.</div>
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
