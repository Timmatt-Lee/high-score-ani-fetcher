import { useState, useRef, useEffect } from "react";
import { useServices } from "../contexts/ServiceContext";
import { useSettings } from "./useSettings";
import { type AnimeItem, type AnimeInfo } from "../services/animeScanner";

export interface ScanUpdateResult {
  updatedScannedList: AnimeItem[];
  updatedFavoriteList: AnimeItem[];
  updatedTrashList: AnimeItem[];
}

export function useAnimeScanner(
  scannedList: AnimeItem[],
  favoriteList: AnimeItem[],
  trashList: AnimeItem[],
  onScanUpdate: (result: ScanUpdateResult) => void,
) {
  const { animeScanner } = useServices();
  const { settings } = useSettings();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({
    percent: 0,
    message: "",
    step: 1,
  });
  const [error, setError] = useState<Error | null>(null);

  const [scanResult, setScanResult] = useState<{
    successCount: number;
    skippedCachedCount: number;
    updatedCount: number;
    addedCount: number;
    failedCount: number;
  } | null>(null);

  // Ref to hold the AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  const scannedListRef = useRef(scannedList);
  const favoriteListRef = useRef(favoriteList);
  const trashListRef = useRef(trashList);

  useEffect(() => {
    scannedListRef.current = scannedList;
    favoriteListRef.current = favoriteList;
    trashListRef.current = trashList;
  }, [scannedList, favoriteList, trashList]);

  const clearError = () => {
    setError(null);
  };

  const handleScan = async () => {
    // Reset state before starting a new scan
    setError(null);
    setProgress({
      percent: 0,
      message: "Loading anime index",
      step: 1,
    });
    setIsScanning(true);

    let skippedCachedCount = 0;
    let updatedCount = 0;
    let addedCount = 0;
    let successCount = 0;

    const scan = async (signal: AbortSignal) => {
      // 1. Get total pages
      const totalPages = await animeScanner.getTotalPages();

      // 2. Scan pages (Stage 1)
      const allItems = await animeScanner.scanPages({
        totalPages,
        requestDelayMs: settings.requestDelayMs,
        onPageScanned: (page) => {
          const percent = Math.round((page / totalPages) * 100);
          setProgress({
            percent,
            message: `Loading anime index (${page}/${totalPages})`,
            step: 1,
          });
        },
        signal,
      });

      // 3. Filter items and calculate skipped/stats in memory (Stage 1 filter)
      const allScannedAnimeMap = new Map<string, AnimeItem>();
      scannedListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));
      favoriteListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));
      trashListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));

      const isScanRequired = (item: AnimeInfo) => {
        const storedAnimeItem = allScannedAnimeMap.get(item.link);
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

      const itemsToScan: AnimeInfo[] = [];
      for (const item of allItems) {
        if (isScanRequired(item)) {
          itemsToScan.push(item);
        } else {
          skippedCachedCount++;
        }
      }

      const detailsTotalCount = itemsToScan.length;

      // Update initial stats with calculated skipped count
      setScanResult({
        successCount: 0,
        skippedCachedCount,
        updatedCount: 0,
        addedCount: 0,
        failedCount: 0,
      });

      // 4. Scan detail pages (Stage 2)
      if (detailsTotalCount > 0) {
        let localCompletedCount = 0;
        await animeScanner.scanAnimeDetails({
          items: itemsToScan,
          requestDelayMs: settings.requestDelayMs,
          onDetailScanned: (item) => {
            localCompletedCount++;
            const detailsPercent = localCompletedCount / detailsTotalCount;
            const rawPercent = Math.floor(detailsPercent * 99);
            const percent = Math.min(99, rawPercent);

            const msg = `Parsing (${localCompletedCount}/${detailsTotalCount})`;
            const finalMsg = `${msg} "${item.title}"`;
            setProgress({
              percent,
              message: finalMsg,
              step: 2,
            });

            successCount++;
            const storedAnimeItem = allScannedAnimeMap.get(item.link);
            if (storedAnimeItem) {
              updatedCount++;
            } else {
              addedCount++;
            }

            setScanResult({
              successCount,
              skippedCachedCount,
              updatedCount,
              addedCount,
              failedCount: 0,
            });

            const currentFav = [...favoriteListRef.current];
            const currentTrash = [...trashListRef.current];
            const currentScanned = [...scannedListRef.current];

            let isUpdated = false;
            for (const list of [currentFav, currentTrash, currentScanned]) {
              const idx = list.findIndex((x) => x.link === item.link);
              if (idx !== -1) {
                list[idx] = item;
                isUpdated = true;
                break;
              }
            }

            if (!isUpdated) {
              currentScanned.push(item);
            }

            onScanUpdate({
              updatedScannedList: currentScanned,
              updatedFavoriteList: currentFav,
              updatedTrashList: currentTrash,
            });

            scannedListRef.current = currentScanned;
            favoriteListRef.current = currentFav;
            trashListRef.current = currentTrash;
          },
          signal,
        });
      }

      // Complete
      onScanUpdate({
        updatedScannedList: [...scannedListRef.current],
        updatedFavoriteList: [...favoriteListRef.current],
        updatedTrashList: [...trashListRef.current],
      });
      setIsScanning(false);
      setProgress({
        percent: 100,
        message: "Done!",
        step: 2,
      });
    };

    setScanResult({
      successCount: 0,
      skippedCachedCount: 0,
      updatedCount: 0,
      addedCount: 0,
      failedCount: 0,
    });

    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    try {
      await scan(signal);
    } catch (err: unknown) {
      if (
        (err instanceof Error || err instanceof DOMException) &&
        err.name === "AbortError"
      ) {
        return;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Scan failed", error);
      setError(error);
      setIsScanning(false);
      setProgress({ percent: 0, message: "", step: 1 });
      setScanResult({
        successCount,
        skippedCachedCount,
        updatedCount,
        addedCount,
        failedCount: 1,
      });
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const cancelScan = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsScanning(false);
    setProgress({ percent: 0, message: "", step: 1 });
  };

  return {
    isScanning,
    progress,
    error,
    clearError,
    handleScan,
    cancelScan,
    scanResult,
    setScanResult,
  };
}
