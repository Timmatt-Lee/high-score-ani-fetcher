import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { AnimeList } from "./components/AnimeList";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, type TabType } from "./components/Tabs";
import styles from "./App.module.css";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<TabType>("search");

  const {
    searchList,
    setSearchList,
    favorites,
    trash,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  } = useAnimeData();

  const { isScanning, progress, handleScan } = useAnimeScanner(
    favorites,
    trash,
    (newItems) => {
      setSearchList(newItems);
      saveData(newItems, favorites, trash);
    },
  );

  return (
    <div className={styles.appContainer}>
      <div className={styles.header}>
        <h1>AniFetcher Pro</h1>
        <button
          className={styles.btn}
          onClick={handleScan}
          disabled={isScanning}
        >
          {isScanning ? "Scanning..." : "Scan 巴哈姆特動漫瘋"}
        </button>
      </div>

      <ProgressBar
        isScanning={isScanning}
        percent={progress.percent}
        message={progress.message}
      />

      <Tabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        searchCount={searchList.length}
        favoritesCount={favorites.length}
        trashCount={trash.length}
      />

      <AnimeList
        activeTab={activeTab}
        searchList={searchList}
        favorites={favorites}
        trash={trash}
        onMoveToFavorites={moveToFavorites}
        onMoveToTrash={moveToTrash}
        onRestoreFromTrash={restoreFromTrash}
      />
    </div>
  );
}

export default App;
