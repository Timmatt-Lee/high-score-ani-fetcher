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
    <div className="tabs">
      <button
        className={`tab ${activeTab === "search" ? "active" : ""}`}
        onClick={() => setActiveTab("search")}
      >
        Results ({searchCount})
      </button>
      <button
        className={`tab ${activeTab === "favorites" ? "active" : ""}`}
        onClick={() => setActiveTab("favorites")}
      >
        Favorites ({favoritesCount})
      </button>
      <button
        className={`tab ${activeTab === "trash" ? "active" : ""}`}
        onClick={() => setActiveTab("trash")}
      >
        Trash ({trashCount})
      </button>
    </div>
  );
}
