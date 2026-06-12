import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { AnimeList } from "./components/AnimeList";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, Tab } from "./components/Tabs";
import { ErrorPanel } from "./components/ErrorPanel/ErrorPanel";
import { ErrorCard } from "./components/ErrorCard/ErrorCard";
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

  const { isScanning, progress, httpErrors, parseErrors, error, handleScan } =
    useAnimeScanner(searchList, favoriteList, trashList, (result) => {
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

      {error ? (
        <div
          className={styles.fatalErrorContainer}
          data-testid="fatal-error-container"
        >
          <ErrorCard error={error} />
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
            <div className={styles.errorsPanel} data-testid="errors-panel">
              <div className={styles.summaryBar}>
                <span
                  className={styles.summaryText}
                  data-testid="errors-summary-text"
                >
                  {totalErrors}{" "}
                  {totalErrors === 1 ? "error occurred" : "errors occurred"}
                </span>
                <button
                  className={`${styles.btn} ${styles.btnRetry}`}
                  onClick={() => {
                    const failedPagesSet = new Set<number>();
                    httpErrors.forEach((err) => {
                      if (err.page) failedPagesSet.add(err.page);
                    });
                    parseErrors.forEach((err) => {
                      if (err.page) failedPagesSet.add(err.page);
                    });
                    handleScan({
                      onlyPages: Array.from(failedPagesSet),
                    });
                  }}
                  disabled={isScanning || totalErrors === 0}
                  data-testid="retry-errors-btn"
                >
                  Retry Failed Animes
                </button>
              </div>

              <div className={styles.accordion}>
                <ErrorPanel
                  title="HTTP Network Errors"
                  testIdPrefix="http-errors"
                  emptyMessage="No network errors."
                  errors={httpErrors}
                />
                <ErrorPanel
                  title="Document Parser Errors"
                  testIdPrefix="parse-errors"
                  emptyMessage="No parser errors."
                  errors={parseErrors}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
