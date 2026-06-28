import { useState, useRef, useEffect } from "react";
import { Subscription } from "rxjs";
import { useServices } from "../contexts/ServiceContext";
import { useSettings } from "./useSettings";
import {
  AnimeScanner,
  type PipelineOptions,
  type AnimeItem,
  AnimeScanPageEvent,
} from "../services/animeScanner";

export interface ScanUpdateResult {
  newSearchItems: AnimeItem[];
  updatedFavoriteList: AnimeItem[];
  updatedTrashList: AnimeItem[];
}

export function useAnimeScanner(
  searchList: AnimeItem[],
  favoriteList: AnimeItem[],
  trashList: AnimeItem[],
  onScanUpdate: (result: ScanUpdateResult) => void,
) {
  const { animeScraper } = useServices();
  const { settings } = useSettings();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({
    percent: 0,
    message: "",
    step: 1,
    stepPercent: 0,
  });
  const [error, setError] = useState<Error | null>(null);
  const [totalPagesCount, setTotalPagesCount] = useState(0);
  const [scanStats, setScanStats] = useState<{
    successCount: number;
    skippedCachedCount: number;
    updatedCount: number;
    addedCount: number;
    failedCount: number;
  } | null>(null);

  // Ref to hold the subscription for cancellation
  const scanSubscriptionRef = useRef<Subscription | null>(null);

  const searchListRef = useRef(searchList);
  const favoriteListRef = useRef(favoriteList);
  const trashListRef = useRef(trashList);

  useEffect(() => {
    searchListRef.current = searchList;
    favoriteListRef.current = favoriteList;
    trashListRef.current = trashList;
  }, [searchList, favoriteList, trashList]);

  const clearError = () => {
    setError(null);
  };

  const handleScan = async (options?: PipelineOptions) => {
    // Reset state before starting a new scan
    setError(null);
    const isRetry = !!(
      options &&
      options.onlyPages &&
      options.onlyPages.length > 0
    );
    setProgress({
      percent: 0,
      message: isRetry ? "Retrying anime index" : "Loading anime index",
      step: 1,
      stepPercent: 0,
    });
    setIsScanning(true);

    let skippedCachedCount = 0;
    let updatedCount = 0;
    let addedCount = 0;
    let successCount = 0;

    setScanStats({
      successCount: 0,
      skippedCachedCount: 0,
      updatedCount: 0,
      addedCount: 0,
      failedCount: 0,
    });

    let totalPages = totalPagesCount;

    if (!isRetry) {
      try {
        const totalPagesResult = await animeScraper.getTotalPages();
        totalPages = totalPagesResult;
        setTotalPagesCount(totalPagesResult);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        console.error("Scan failed", error);
        setError(error);
        setIsScanning(false);
        setProgress({ percent: 0, message: "", step: 1, stepPercent: 0 });
        setScanStats({
          successCount: 0,
          skippedCachedCount: 0,
          updatedCount: 0,
          addedCount: 0,
          failedCount: 1,
        });
        return;
      }
    }

    const existingMap = new Map<string, AnimeItem>();
    searchListRef.current.forEach((x) => existingMap.set(x.link, x));
    favoriteListRef.current.forEach((x) => existingMap.set(x.link, x));
    trashListRef.current.forEach((x) => existingMap.set(x.link, x));

    const filterItem = (item: AnimeItem) => {
      // Skip scanning details if cached data is still valid and within cache duration
      const storedAnimeItem = existingMap.get(item.link);
      if (storedAnimeItem) {
        if (storedAnimeItem.scannedAt) {
          const ageMs =
            Date.now() - new Date(storedAnimeItem.scannedAt).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays < settings.cacheExpireDays) {
            return false;
          }
        }

        const threshold =
          settings.targetScore * (settings.rescanThreshold / 100);
        if (storedAnimeItem.score > 0 && storedAnimeItem.score < threshold) {
          return false;
        }
      }

      if (isNaN(item.episodeCount) || item.episodeCount < 10) return false;
      if (item.title.includes("OVA")) return false;

      return true;
    };

    let detailsCompletedCount = 0;
    let detailsTotalCount = 0;

    const filterAndCountItem = (item: AnimeItem) => {
      const storedAnimeItem = existingMap.get(item.link);
      let isSkippedCached = false;
      if (storedAnimeItem) {
        if (storedAnimeItem.scannedAt) {
          const ageMs =
            Date.now() - new Date(storedAnimeItem.scannedAt).getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          if (ageDays < settings.cacheExpireDays) {
            isSkippedCached = true;
          }
        }

        const threshold =
          settings.targetScore * (settings.rescanThreshold / 100);
        if (storedAnimeItem.score > 0 && storedAnimeItem.score < threshold) {
          isSkippedCached = true;
        }
      }

      const isKept = filterItem(item);
      if (isKept) {
        detailsTotalCount++;
      } else if (isSkippedCached) {
        skippedCachedCount++;
        setScanStats({
          successCount,
          skippedCachedCount,
          updatedCount,
          addedCount,
          failedCount: 0,
        });
      }
      return isKept;
    };

    const updateProgress = (currentTitle: string) => {
      const detailsPercent =
        detailsTotalCount > 0 ? detailsCompletedCount / detailsTotalCount : 0;
      const rawPercent = Math.floor(detailsPercent * 99);
      const percent = Math.min(99, rawPercent);

      const msg = `Parsing (${detailsCompletedCount}/${detailsTotalCount})`;
      const truncated = currentTitle.slice(0, 30);
      const finalMsg = `${msg} "${truncated}"`;
      setProgress({
        percent,
        message: finalMsg,
        step: 2,
        stepPercent: percent,
      });
    };

    const pipelineOptions: PipelineOptions = {
      requestDelayMs: settings.requestDelayMs,
      ...(isRetry && options?.onlyPages
        ? { onlyPages: options.onlyPages }
        : {}),
    };

    const pipeline = new AnimeScanner(
      totalPages,
      filterAndCountItem,
      animeScraper,
      pipelineOptions,
    );

    // Subscribe to the scan observable and keep reference for cancellation
    const subscription = pipeline.scan().subscribe({
      next: (event) => {
        if (event instanceof AnimeScanPageEvent) {
          const actionPrefix = isRetry
            ? "Retrying anime index"
            : "Loading anime index";
          const stepPercent =
            event.totalPages > 0
              ? Math.round((event.currentPage / event.totalPages) * 100)
              : 0;
          setProgress({
            percent: 0,
            message: `${actionPrefix} (${event.currentPage}/${event.totalPages})`,
            step: 1,
            stepPercent,
          });
        } else if (!(event instanceof Error)) {
          detailsCompletedCount++;
          updateProgress(event.title);

          successCount++;
          const storedAnimeItem = existingMap.get(event.link);
          if (storedAnimeItem) {
            updatedCount++;
          } else {
            addedCount++;
          }
          setScanStats({
            successCount,
            skippedCachedCount,
            updatedCount,
            addedCount,
            failedCount: 0,
          });

          const currentFav = [...favoriteListRef.current];
          const currentTrash = [...trashListRef.current];
          const currentSearch = [...searchListRef.current];

          let isUpdated = false;
          for (const list of [currentFav, currentTrash, currentSearch]) {
            const idx = list.findIndex((x) => x.link === event.link);
            if (idx !== -1) {
              list[idx] = event;
              isUpdated = true;
              break;
            }
          }

          if (!isUpdated) {
            currentSearch.push(event);
          }

          onScanUpdate({
            newSearchItems: currentSearch,
            updatedFavoriteList: currentFav,
            updatedTrashList: currentTrash,
          });

          searchListRef.current = currentSearch;
          favoriteListRef.current = currentFav;
          trashListRef.current = currentTrash;
        }
      },
      complete: () => {
        onScanUpdate({
          newSearchItems: [...searchListRef.current],
          updatedFavoriteList: [...favoriteListRef.current],
          updatedTrashList: [...trashListRef.current],
        });
        setIsScanning(false);
        setProgress({
          percent: 100,
          message: "Done!",
          step: 2,
          stepPercent: 100,
        });
      },
      error: (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsScanning(false);
        setProgress({ percent: 0, message: "", step: 1, stepPercent: 0 });
        setScanStats({
          successCount,
          skippedCachedCount,
          updatedCount,
          addedCount,
          failedCount: 1,
        });
      },
    });
    // Store subscription reference for later cancellation
    scanSubscriptionRef.current = subscription;
  };

  const cancelScan = () => {
    if (scanSubscriptionRef.current) {
      scanSubscriptionRef.current.unsubscribe();
      scanSubscriptionRef.current = null;
    }
    setIsScanning(false);
    setProgress({ percent: 0, message: "", step: 1, stepPercent: 0 });
  };

  return {
    isScanning,
    progress,
    error,
    clearError,
    handleScan,
    cancelScan,
    scanStats,
    setScanStats,
  };
}
