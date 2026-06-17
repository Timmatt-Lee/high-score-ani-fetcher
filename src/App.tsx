import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { AnimeList } from "./components/AnimeList";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, Tab } from "./components/Tabs";
import { ErrorPanel } from "./components/ErrorPanel/ErrorPanel";
import { ErrorCard } from "./components/ErrorCard/ErrorCard";
import { SettingsTab } from "./components/SettingsTab";
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
    animeCache,
    setAnimeCache,
    settings,
    setSettings,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  } = useAnimeData();

  const { isScanning, progress, httpErrors, parseErrors, error, handleScan } =
    useAnimeScanner(
      searchList,
      favoriteList,
      trashList,
      animeCache,
      settings,
      (result) => {
        setSearchList(result.newSearchItems);
        setFavoriteList(result.updatedFavoriteList);
        setTrashList(result.updatedTrashList);
        saveData(
          result.newSearchItems,
          result.updatedFavoriteList,
          result.updatedTrashList,
          animeCache,
          settings,
        );
      },
      (newItem) => {
        // Real-time cache update
        const snMatch = newItem.link.match(/sn=(\d+)/);
        const sn = snMatch ? snMatch[1] : newItem.link;
        setAnimeCache((prev) => {
          const newCache = {
            ...prev,
            [sn]: {
              ...newItem,
              _cacheTimestamp: Date.now(),
            },
          };
          saveData(searchList, favoriteList, trashList, newCache, settings);
          return newCache;
        });

        // If eligible and not in trash/fav, show it immediately!
        if (newItem.score >= settings.targetScore) {
          setSearchList((prev) => {
            const isFav = favoriteList.some((f) => f.link === newItem.link);
            const isTrash = trashList.some((t) => t.link === newItem.link);
            if (!isFav && !isTrash) {
              const map = new Map(prev.map((i) => [i.link, i]));
              map.set(newItem.link, newItem);
              return Array.from(map.values()).sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return a.title.localeCompare(b.title);
              });
            }
            return prev;
          });
        }
      },
    );

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

          {activeTab === Tab.Settings ? (
            <div className="flex-1 overflow-hidden">
              <SettingsTab settings={settings} onSaveSettings={setSettings} />
            </div>
          ) : (
            <AnimeList
              activeTab={activeTab}
              searchList={searchList}
              favoriteList={favoriteList}
              trashList={trashList}
              isScanning={isScanning}
              onMoveToFavorites={moveToFavorites}
              onMoveToTrash={moveToTrash}
              onRestoreFromTrash={restoreFromTrash}
            />
          )}

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
