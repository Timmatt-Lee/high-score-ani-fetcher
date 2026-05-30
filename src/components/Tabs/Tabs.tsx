/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";

export enum Tab {
  Search,
  Favorites,
  Trash,
  Errors,
}

interface TabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  searchCount: number;
  favoritesCount: number;
  trashCount: number;
  errorsCount: number;
}

export function Tabs({
  activeTab,
  setActiveTab,
  searchCount,
  favoritesCount,
  trashCount,
  errorsCount,
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
      <button
        className={`${styles.tab} ${activeTab === Tab.Errors ? styles.active : ""} ${errorsCount > 0 ? styles.hasErrors : ""}`}
        onClick={() => setActiveTab(Tab.Errors)}
      >
        Errors ({errorsCount})
      </button>
    </div>
  );
}
