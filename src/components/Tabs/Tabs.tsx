/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";

export enum Tab {
  Search = "search",
  Favorites = "favorites",
  Trash = "trash",
}

interface TabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
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
        className={`${styles.tab} ${activeTab === Tab.Search ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Search)}
      >
        Results ({searchCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Favorites ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Favorites)}
      >
        Favorites ({favoritesCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Trash ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Trash)}
      >
        Trash ({trashCount})
      </button>
    </div>
  );
}
