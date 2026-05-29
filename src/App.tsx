import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { AnimeList } from "./components/AnimeList";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, Tab } from "./components/Tabs";
import styles from "./App.module.css";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Search);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

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

  const { isScanning, progress, httpErrors, parseErrors, handleScan } =
    useAnimeScanner(favorites, trash, (newItems) => {
      setSearchList(newItems);
      saveData(newItems, favorites, trash);
    });

  const totalErrors = httpErrors.length + parseErrors.length;

  return (
    <div className={styles.appContainer} data-testid="app-container">
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

      {totalErrors > 0 && (
        <div className={styles.warningAlert}>
          <div className={styles.warningHeader}>
            <span>
              ⚠️ Scan completed with {totalErrors} parsing/network errors.
              Remaining items were loaded.
            </span>
            <button
              className={styles.toggleDetailsBtn}
              onClick={() => setShowErrorDetails(!showErrorDetails)}
            >
              {showErrorDetails ? "Hide Details" : "Show Details"}
            </button>
          </div>
          {showErrorDetails && (
            <ul className={styles.warningList}>
              {[...httpErrors, ...parseErrors].slice(0, 10).map((err, i) => (
                <li key={i} className={styles.warningItem}>
                  {err.name} (URL: {err.url || "unknown"}) — {err.message}
                </li>
              ))}
              {totalErrors > 10 && (
                <li className={styles.warningItem}>
                  And {totalErrors - 10} more errors...
                </li>
              )}
            </ul>
          )}
        </div>
      )}

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
