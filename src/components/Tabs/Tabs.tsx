/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";

export enum Tab {
  Search,
  Favorites,
  Trash,
  Settings,
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
        title="View scanned anime results"
        data-tooltip="View scanned anime results"
      >
        Results ({searchCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Favorites ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Favorites)}
        title="View your favorite anime list"
        data-tooltip="View your favorite anime list"
      >
        Favorites ({favoritesCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Trash ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Trash)}
        title="View trashed anime list"
        data-tooltip="View trashed anime list"
      >
        Trash ({trashCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Settings ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Settings)}
        title="Open scanner configurations"
        data-tooltip="Open scanner configurations"
      >
        Settings
      </button>
    </div>
  );
}
