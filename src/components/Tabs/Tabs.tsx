import styles from "./Tabs.module.css";

export type TabType = "search" | "favorites" | "trash";

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
        className={`${styles.tab} ${activeTab === "search" ? styles.active : ""}`}
        onClick={() => setActiveTab("search")}
      >
        Results ({searchCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === "favorites" ? styles.active : ""}`}
        onClick={() => setActiveTab("favorites")}
      >
        Favorites ({favoritesCount})
      </button>
      <button
        className={`${styles.tab} ${activeTab === "trash" ? styles.active : ""}`}
        onClick={() => setActiveTab("trash")}
      >
        Trash ({trashCount})
      </button>
    </div>
  );
}
