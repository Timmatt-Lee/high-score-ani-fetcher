/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";

export enum TabType {
  Search = "search",
  Favorites = "favorites",
  Trash = "trash",
}

interface TabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  searchCount: number;
  favoritesCount: number;
  trashCount: number;
}

export function Tabs({
  activeTab,
  setActiveTab,
  searchCount,
  favoritesCount,
  trashCount,
}: TabsProps) {
  return (
    <div className={styles.tabs} data-testid="tabs-container">
      <button
        className={`${styles.tab} ${activeTab === TabType.Search ? styles.active : ""}`}
        onClick={() => setActiveTab(TabType.Search)}
      >
        Results ({searchCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === TabType.Favorites ? styles.active : ""}`}
        onClick={() => setActiveTab(TabType.Favorites)}
      >
        Favorites ({favoritesCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === TabType.Trash ? styles.active : ""}`}
        onClick={() => setActiveTab(TabType.Trash)}
      >
        Trash ({trashCount})
      </button>
    </div>
  );
}
