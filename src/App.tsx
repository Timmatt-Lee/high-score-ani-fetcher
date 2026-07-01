import React, { useState, useRef } from "react";
import styles from "./App.module.css";
import { Tabs, Tab } from "./components/Tabs/Tabs";
import { ProgressBar } from "./components/ProgressBar/ProgressBar";
import { ResultBanner } from "./components/ResultBanner/ResultBanner";
import { AnimeTable } from "./components/AnimeTable/AnimeTable";
import { ErrorCard } from "./components/ErrorCard/ErrorCard";
import { useAnimeScanner } from "./hooks/useAnimeScanner";
import { useAnimeData } from "./hooks/useAnimeData";
import { useSettings } from "./hooks/useSettings";
import { SettingsTab } from "./components/SettingsTab/SettingsTab";
import { type AnimeItem } from "./services/animeScanner";
import { StopIcon } from "./components/Icons";

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Scanned);
  const [sortBy, setSortBy] = useState<
    "title" | "score" | "watchCount" | "uploadDate" | "episodeCount"
  >("watchCount");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Draggable floating bar state
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const floatingBarRef = useRef<HTMLDivElement | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Avoid triggering drag if clicking action buttons inside the banner
    if ((e.target as HTMLElement).closest("button")) return;

    isDraggingRef.current = true;
    dragStartRef.current = {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      setDragOffset({
        x: moveEvent.clientX - dragStartRef.current.x,
        y: moveEvent.clientY - dragStartRef.current.y,
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const { settings, saveSettings, isLoaded: isSettingsLoaded } = useSettings();

  const {
    scannedList,
    favoriteList,
    trashList,
    moveToFavorites,
    moveToTrash,
    updateLists,
    isLoaded: isAnimeDataLoaded,
  } = useAnimeData();

  const {
    isScanning,
    progress,
    error,
    clearError,
    handleScan,
    cancelScan,
    scanResult,
    clearScanResult,
  } = useAnimeScanner(scannedList, favoriteList, trashList, (result) => {
    updateLists(
      result.updatedScannedList,
      result.updatedFavoriteList,
      result.updatedTrashList,
    );
  });

  const [appError, setAppError] = useState<Error | null>(null);
  const activeError = error || appError;
  const handleDismissError = () => {
    clearError();
    setAppError(null);
  };

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
        const timeA = new Date(a.uploadDate).getTime();
        const timeB = new Date(b.uploadDate).getTime();
        const valA = isNaN(timeA) ? 0 : timeA;
        const valB = isNaN(timeB) ? 0 : timeB;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      if (typeof valA === "string" && typeof valB === "string") {
        return sortOrder === "asc"
          ? valA.localeCompare(valB, "zh-Hant")
          : valB.localeCompare(valA, "zh-Hant");
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      return 0;
    });
  };

  if (!isSettingsLoaded || !isAnimeDataLoaded) {
    return null;
  }

  const displayedScannedList = scannedList.filter(
    (item) => item.score >= settings.targetScore,
  );

  return (
    <div className={styles.appContainer} data-testid="app-container">
      <div className={styles.headerBg} />
      <div className={styles.headerSpacer} />
      <div className={styles.header}>
        <div className={styles.titleWrapper}>
          <img src="/icon.png" alt="Logo" className={styles.logoIcon} />
          <h1>巴哈動畫評分</h1>
        </div>

        <div className={styles.headerCenter}>
          <Tabs
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            scannedCount={displayedScannedList.length}
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
              onClick={() => handleScan()}
              disabled={isScanning}
              title="Start scanning anime list from Bahamut"
            >
              Scan
            </button>
          )}
        </div>
      </div>

      <div className={styles.contentArea}>
        {activeError && (
          <div
            className={styles.fatalErrorContainer}
            data-testid="fatal-error-container"
          >
            <ErrorCard error={activeError} onDismiss={handleDismissError} />
          </div>
        )}

        {activeTab === Tab.Settings ? (
          <SettingsTab
            settings={settings}
            onSave={saveSettings}
            scannedList={scannedList}
            favoriteList={favoriteList}
            trashList={trashList}
            onImportData={({
              scannedList: s,
              favoriteList: f,
              trashList: t,
            }) => {
              updateLists(s, f, t);
            }}
            onError={setAppError}
          />
        ) : (
          <AnimeTable
            activeTab={activeTab}
            list={getSortedList(
              activeTab === Tab.Scanned
                ? displayedScannedList
                : activeTab === Tab.Favorites
                  ? favoriteList
                  : trashList,
            )}
            onMoveToFavorites={moveToFavorites}
            onMoveToTrash={moveToTrash}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            targetScore={settings.targetScore}
          />
        )}
      </div>

      {(isScanning || (scanResult && !isScanning)) && (
        <div
          ref={floatingBarRef}
          className={styles.floatingStatusContainer}
          style={{
            transform: `translate(calc(-50% + ${dragOffset.x}px), ${dragOffset.y}px)`,
          }}
          onMouseDown={handleMouseDown}
          data-testid="floating-status-bar"
        >
          <div className={styles.floatingContent}>
            {isScanning ? (
              <ProgressBar
                stepsCount={2}
                currentStepIndex={progress.step - 1}
                currentStepPercent={progress.percent}
                message={progress.message}
              />
            ) : (
              scanResult && (
                <ResultBanner
                  successCount={scanResult.successCount}
                  addedCount={scanResult.addedCount}
                  updatedCount={scanResult.updatedCount}
                  skippedCachedCount={scanResult.skippedCachedCount}
                  failedCount={scanResult.failedCount}
                  onDismiss={() => clearScanResult()}
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
