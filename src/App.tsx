import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { AnimeList } from "./components/AnimeList";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, Tab } from "./components/Tabs";
import { ErrorCard } from "./components/ErrorCard/ErrorCard";
import { ErrorsPanel } from "./components/ErrorsPanel/ErrorsPanel";
import styles from "./App.module.css";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Search);

  const {
    searchList,
    setSearchList,
    favoriteList,
    setFavoriteList,
    trashList,
    setTrashList,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  } = useAnimeData();

  const {
    isScanning,
    progress,
    httpErrors,
    parseErrors,
    fatalError,
    clearFatalError,
    handleScan,
    failedDetails,
  } = useAnimeScanner(searchList, favoriteList, trashList, (result) => {
    setSearchList(result.newSearchItems);
    setFavoriteList(result.updatedFavoriteList);
    setTrashList(result.updatedTrashList);
    saveData(
      result.newSearchItems,
      result.updatedFavoriteList,
      result.updatedTrashList,
    );
  });

  const totalErrors = httpErrors.length + parseErrors.length;

  return (
    <div className={styles.appContainer} data-testid="app-container">
      <div className={styles.header}>
        <h1>AniFetcher Pro</h1>
        <button
          className={styles.btn}
          onClick={() => handleScan()}
          disabled={isScanning}
        >
          {isScanning ? "Scanning..." : "Scan 巴哈姆特動漫瘋"}
        </button>
      </div>

      {fatalError ? (
        <div
          className={styles.fatalErrorContainer}
          data-testid="fatal-error-container"
        >
          <ErrorCard error={fatalError} />
          <button
            className={`${styles.btn} ${styles.dismissBtn}`}
            onClick={clearFatalError}
            data-testid="error-card-dismiss-btn"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <>
          <ProgressBar
            isScanning={isScanning}
            percent={progress.percent}
            message={progress.message}
          />

          <Tabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchCount={searchList.length}
            favoritesCount={favoriteList.length}
            trashCount={trashList.length}
          />

          <AnimeList
            activeTab={activeTab}
            searchList={searchList}
            favoriteList={favoriteList}
            trashList={trashList}
            onMoveToFavorites={moveToFavorites}
            onMoveToTrash={moveToTrash}
            onRestoreFromTrash={restoreFromTrash}
          />

          {activeTab === Tab.Search && totalErrors > 0 && !isScanning && (
            <ErrorsPanel
              httpErrors={httpErrors}
              parseErrors={parseErrors}
              failedDetails={failedDetails}
              isScanning={isScanning}
              onRetry={() => handleScan()}
            />
          )}
        </>
      )}
    </div>
  );
}

export default App;
