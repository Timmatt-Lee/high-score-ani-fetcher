import { useState } from "react";
import { useAnimeData } from "./hooks/useAnimeData";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { type AnimeItem } from "./services/animeScanner";
import { useSettings } from "./hooks/useSettings";
import { AnimeTable } from "./components/AnimeTable";
import { ProgressBar } from "./components/ProgressBar";
import { Tabs, Tab } from "./components/Tabs";
import { ResultBanner } from "./components/ResultBanner";
import { ErrorCard } from "./components/ErrorCard/ErrorCard";
import { SettingsTab } from "./components/SettingsTab";
import { StopIcon } from "./components/Icons";
import styles from "./App.module.css";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Search);
  const [sortBy, setSortBy] = useState<
    "title" | "score" | "watchCount" | "uploadDate" | "episodeCount"
  >("watchCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const startX = e.clientX - dragOffset.x;
    const startY = e.clientY - dragOffset.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      setDragOffset({
        x: moveEvent.clientX - startX,
        y: moveEvent.clientY - startY,
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

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
    error,
    clearError,
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
        <div className={styles.titleWrapper}>
          <img src="/icon.png" alt="Logo" className={styles.logoIcon} />
          <h1>巴哈動畫評分</h1>
        </div>

        <div className={styles.headerCenter}>
          <Tabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            searchCount={displayedSearchList.length}
            favoritesCount={favoriteList.length}
            trashCount={trashList.length}
          />
        </div>

        <div className={styles.headerRight}>
          {isScanning ? (
            <button
              className={`${styles.btn} ${styles.btnStop}`}
              onClick={cancelScan}
              disabled={!isScanning}
              aria-label="Stop Scan"
              title="Stop Scan"
            >
              <StopIcon width="16" height="16" />
            </button>
          ) : (
            <button
              className={styles.btn}
              onClick={() =>
                handleScan({ requestDelayMs: settings.requestDelayMs })
              }
              disabled={isScanning}
              title="Start scanning anime list from Bahamut"
            >
              Scan
            </button>
          )}
        </div>
      </div>

      <div className={styles.contentArea}>
        {error && (
          <div
            className={styles.fatalErrorContainer}
            data-testid="fatal-error-container"
          >
            <ErrorCard error={error} onDismiss={clearError} />
          </div>
        )}

        {activeTab === Tab.Settings ? (
          <SettingsTab
            settings={settings}
            onSave={saveSettings}
            searchList={searchList}
            favoriteList={favoriteList}
            trashList={trashList}
            onImportData={({
              searchList: s,
              favoriteList: f,
              trashList: t,
            }) => {
              setSearchList(s);
              setFavoriteList(f);
              setTrashList(t);
              saveData(s, f, t);
            }}
          />
        ) : (
          <AnimeTable
            activeTab={activeTab}
            list={getSortedList(
              activeTab === Tab.Search
                ? displayedSearchList
                : activeTab === Tab.Favorites
                  ? favoriteList
                  : trashList,
            )}
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

      {(isScanning || (scanStats && !isScanning)) && (
        <div
          className={styles.floatingStatusContainer}
          style={{
            transform: `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px)`,
          }}
          data-testid="floating-status-bar"
        >
          <div
            className={styles.dragHandle}
            onMouseDown={handleMouseDown}
            title="Drag to reposition"
            data-testid="floating-status-drag-handle"
          >
            <div className={styles.dragDotRow}>
              <span className={styles.dragDot}></span>
              <span className={styles.dragDot}></span>
            </div>
            <div className={styles.dragDotRow}>
              <span className={styles.dragDot}></span>
              <span className={styles.dragDot}></span>
            </div>
            <div className={styles.dragDotRow}>
              <span className={styles.dragDot}></span>
              <span className={styles.dragDot}></span>
            </div>
          </div>
          <div className={styles.floatingContent}>
            {isScanning ? (
              <ProgressBar
                percent={progress.percent}
                message={progress.message}
              />
            ) : (
              scanStats && (
                <ResultBanner
                  successCount={scanStats.successCount}
                  addedCount={scanStats.addedCount}
                  refetchedCount={scanStats.refetchedCount}
                  skippedCachedCount={scanStats.skippedCachedCount}
                  failedCount={scanStats.failedCount}
                  onDismiss={() => setScanStats(null)}
                />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
