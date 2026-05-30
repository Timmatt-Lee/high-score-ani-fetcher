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
  const [isCopied, setIsCopied] = useState(false);

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
  } = useAnimeScanner(favoriteList, trashList, (result) => {
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

  const getFormattedErrorDetails = () => {
    const error = fatalError!;
    let details = `Error Name: ${error.name}\n`;
    details += `Message: ${error.message}\n`;
    if ("url" in error && error.url) {
      details += `URL: ${error.url}\n`;
    }
    if ("status" in error && error.status !== undefined) {
      details += `Status Code: ${error.status}\n`;
    }
    if ("source" in error && error.source !== undefined) {
      details += `Source Component: ${error.source}\n`;
    }
    if (error.stack) {
      details += `\nStack Trace:\n${error.stack}\n`;
    }
    return details;
  };

  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(getFormattedErrorDetails());
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy error details", err);
    }
  };

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

      {fatalError ? (
        <div
          className={styles.fatalErrorScreen}
          data-testid="fatal-error-screen"
        >
          <div className={styles.errorIcon}>❌</div>
          <h2>Something went wrong</h2>
          <p className={styles.errorSubtitle}>
            A fatal error occurred during the scanning process.
          </p>

          <div className={styles.errorBox}>
            <strong>{fatalError.name}</strong>: {fatalError.message}
          </div>

          <div className={styles.errorDetailsHeader}>
            <span>Error Info</span>
            <button
              className={`${styles.btn} ${styles.btnSecondary}`}
              onClick={handleCopyError}
              data-testid="copy-error-btn"
            >
              {isCopied ? "Copied! ✓" : "Copy Error"}
            </button>
          </div>

          <textarea
            className={styles.errorTextArea}
            readOnly
            value={getFormattedErrorDetails()}
            data-testid="error-details-textarea"
          />

          <button
            className={`${styles.btn} ${styles.dismissBtn}`}
            onClick={clearFatalError}
            data-testid="dismiss-error-btn"
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
                  {[...httpErrors, ...parseErrors]
                    .slice(0, 10)
                    .map((err, i) => (
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
        </>
      )}
    </div>
  );
}

export default App;
