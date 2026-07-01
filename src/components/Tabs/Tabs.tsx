/* eslint-disable react-refresh/only-export-components */
import styles from "./Tabs.module.css";
import { SearchIcon, HeartIcon, TrashIcon, SettingsIcon } from "../Icons";

export enum Tab {
  Scanned,
  Favorites,
  Trash,
  Settings,
}

interface TabsProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  scannedCount: number;
  favoritesCount: number;
  trashCount: number;
}

export function Tabs({
  activeTab,
  setActiveTab,
  scannedCount,
  favoritesCount,
  trashCount,
}: TabsProps) {
  return (
    <div className={styles.tabs} data-testid="tabs-container">
      <button
        className={`${styles.tab} ${activeTab === Tab.Scanned ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Scanned)}
        title="View scanned anime results"
        data-testid="tab-scanned"
      >
        <SearchIcon width="16" height="16" className={styles.tabIcon} />
        <span className={styles.tabText}>Results</span>
        <span className={styles.tabCount} data-testid="tab-badge-scanned">
          {scannedCount}
        </span>
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Favorites ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Favorites)}
        title="View your favorite anime list"
        data-testid="tab-favorites"
      >
        <HeartIcon width="16" height="16" className={styles.tabIcon} />
        <span className={styles.tabText}>Favorites</span>
        <span className={styles.tabCount} data-testid="tab-badge-favorites">
          {favoritesCount}
        </span>
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Trash ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Trash)}
        title="View trashed anime list"
        data-testid="tab-trash"
      >
        <TrashIcon width="16" height="16" className={styles.tabIcon} />
        <span className={styles.tabText}>Trash</span>
        <span className={styles.tabCount} data-testid="tab-badge-trash">
          {trashCount}
        </span>
      </button>
      <button
        className={`${styles.tab} ${activeTab === Tab.Settings ? styles.active : ""}`}
        onClick={() => setActiveTab(Tab.Settings)}
        title="Open scanner configurations"
        data-testid="tab-settings"
      >
        <SettingsIcon width="16" height="16" className={styles.tabIcon} />
        <span className={styles.tabText}>Settings</span>
      </button>
    </div>
  );
}
