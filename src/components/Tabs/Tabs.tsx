/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";
import { SearchIcon, HeartIcon, TrashIcon, SettingsIcon } from "../Icons";

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
      >
        <SearchIcon width="20" height="20" className={styles.tabIcon} />
        <span className={styles.tabTextContainer}>
          <span>Results</span>
          <span>({searchCount})</span>
        </span>
        {searchCount > 0 && (
          <span className={styles.tabBadge} data-testid="tab-badge-search">
            {searchCount}
          </span>
        )}
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Favorites ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Favorites)}
        title="View your favorite anime list"
      >
        <HeartIcon width="20" height="20" className={styles.tabIcon} />
        <span className={styles.tabTextContainer}>
          <span>Favorites</span>
          <span>({favoritesCount})</span>
        </span>
        {favoritesCount > 0 && (
          <span className={styles.tabBadge} data-testid="tab-badge-favorites">
            {favoritesCount}
          </span>
        )}
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Trash ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Trash)}
        title="View trashed anime list"
      >
        <TrashIcon width="20" height="20" className={styles.tabIcon} />
        <span className={styles.tabTextContainer}>
          <span>Trash</span>
          <span>({trashCount})</span>
        </span>
        {trashCount > 0 && (
          <span className={styles.tabBadge} data-testid="tab-badge-trash">
            {trashCount}
          </span>
        )}
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Settings ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Settings)}
        title="Open scanner configurations"
      >
        <SettingsIcon width="20" height="20" className={styles.tabIcon} />
        <span className={styles.tabTextContainer}>
          <span>Settings</span>
        </span>
      </button>
    </div>
  );
}
