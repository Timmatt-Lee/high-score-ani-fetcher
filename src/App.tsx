import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { type AnimeItem } from "./services/animeScanner";
import { useSettings } from "./hooks/useSettings";
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
  const [sortBy, setSortBy] = useState<
    "title" | "score" | "watchCount" | "uploadDate" | "episodeCount"
  >("watchCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const { settings, saveSettings, isLoaded: isSettingsLoaded } = useSettings();

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
    isLoaded: isAnimeDataLoaded,
  } = useAnimeData();

  const {
    isScanning,
    progress,
    httpErrors,
    parseErrors,
    error,
    handleScan,
    cancelScan,
    scanStats,
    setScanStats,
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

  const handleSort = (
    field: "title" | "score" | "watchCount" | "uploadDate" | "episodeCount",
  ) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  const getSortedList = (list: AnimeItem[]) => {
    return [...list].sort((a, b) => {
      const valA = a[sortBy];
      const valB = b[sortBy];

      if (sortBy === "uploadDate") {
        const timeA = a.uploadDate.getTime();
        const timeB = b.uploadDate.getTime();
        const valA = isNaN(timeA) ? 0 : timeA;
        const valB = isNaN(timeB) ? 0 : timeB;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB, "zh-Hant")
          : valB.localeCompare(valA, "zh-Hant");
      }

      // Remaining sortable properties (score, watchCount, episodeCount) are numbers
      const numA = valA as number;
      const numB = valB as number;
      return sortOrder === "asc" ? numA - numB : numB - numA;
    });
  };

  if (!isSettingsLoaded || !isAnimeDataLoaded) {
    return null;
  }

  const displayedSearchList = searchList.filter(
    (item) => item.score >= settings.targetScore,
  );

  return (
    <div className={styles.appContainer} data-testid="app-container">
      <div className={styles.header}>
        <h1>巴哈姆特動漫瘋 Scanner</h1>

        <div className={styles.headerCenter}>
          {isScanning ? (
            <ProgressBar
              isScanning={isScanning}
              percent={progress.percent}
              message={progress.message}
            />
          ) : (
            scanStats && (
              <div
                className={styles.inlineStats}
                data-testid="scan-stats-container"
              >
                <span
                  className={`${styles.inlineStatBadge} ${styles.statSuccess}`}
                  title="Fetched"
                >
                  ✓ {scanStats.successCount}
                </span>
                <span
                  className={`${styles.inlineStatBadge} ${styles.statNew}`}
                  title="New"
                >
                  + {scanStats.addedCount}
                </span>
                <span
                  className={`${styles.inlineStatBadge} ${styles.statUpdated}`}
                  title="Updated"
                >
                  ↻ {scanStats.refetchedCount}
                </span>
                <span
                  className={`${styles.inlineStatBadge} ${styles.statCached}`}
                  title="Cached"
                >
                  ⧗ {scanStats.skippedCachedCount}
                </span>
                <span
                  className={`${styles.inlineStatBadge} ${styles.statFailed}`}
                  title="Failed"
                >
                  ⚠ {scanStats.failedCount}
                </span>
                <button
                  className={styles.inlineStatsCloseBtn}
                  onClick={() => setScanStats(null)}
                  aria-label="Dismiss Results"
                >
                  ✕
                </button>
              </div>
            )
          )}
        </div>

        <div className={styles.headerRight}>
          {isScanning ? (
            <button
              className={styles.btn}
              onClick={cancelScan}
              disabled={!isScanning}
            >
              Stop Scan
            </button>
          ) : (
            <button
              className={styles.btn}
              onClick={() =>
                handleScan({ requestDelayMs: settings.requestDelayMs })
              }
              disabled={isScanning}
            >
              Scan 巴哈姆特動漫瘋
            </button>
          )}
        </div>
      </div>

      <div className={styles.mainLayout}>
        <div className={styles.sidebar}>
          <Tabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchCount={displayedSearchList.length}
            favoritesCount={favoriteList.length}
            trashCount={trashList.length}
          />
        </div>

        <div className={styles.contentArea}>
          {error && (
            <div
              className={styles.fatalErrorContainer}
              data-testid="fatal-error-container"
            >
              <ErrorCard error={error} />
            </div>
          )}

          {activeTab === Tab.Search && totalErrors > 0 && !isScanning && (
            <div className={styles.errorsPanel} data-testid="errors-panel">
              <div className={styles.summaryBar}>
                <span className={styles.summaryText}>
                  {totalErrors} errors occurred
                </span>
                <button
                  className={`${styles.btn} ${styles.btnRetry}`}
                  data-testid="retry-errors-btn"
                  disabled={isScanning}
                  onClick={() => {
                    const failedPages = [
                      ...new Set([
                        ...httpErrors.map((e) => e.page),
                        ...parseErrors.map((e) => e.page),
                      ]),
                    ];
                    handleScan({
                      onlyPages: failedPages,
                      requestDelayMs: settings.requestDelayMs,
                    });
                  }}
                >
                  Retry Failed
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

          {activeTab === Tab.Settings ? (
            <SettingsTab settings={settings} onSave={saveSettings} />
          ) : (
            <AnimeList
              activeTab={activeTab}
              searchList={getSortedList(displayedSearchList)}
              favoriteList={getSortedList(favoriteList)}
              trashList={getSortedList(trashList)}
              onMoveToFavorites={moveToFavorites}
              onMoveToTrash={moveToTrash}
              onRestoreFromTrash={restoreFromTrash}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              targetScore={settings.targetScore}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
