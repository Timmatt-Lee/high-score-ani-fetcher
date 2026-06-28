import { useState, useRef, useEffect } from "react";
import { Subscription } from "rxjs";
import { useServices } from "../contexts/ServiceContext";
import { useSettings } from "./useSettings";
import {
  AnimeScanner,
  type ScannerOptions,
  type AnimeItem,
  AnimeScanPageEvent,
  AnimeScanSkippedEvent,
  AnimeScanQueuedEvent,
} from "../services/animeScanner";

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
  const { animeScraper } = useServices();
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

  // Ref to hold the subscription for cancellation
  const scanSubscriptionRef = useRef<Subscription | null>(null);

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

    setScanResult({
      successCount: 0,
      skippedCachedCount: 0,
      updatedCount: 0,
      addedCount: 0,
      failedCount: 0,
    });

    let totalPages: number;

    try {
      const totalPagesResult = await animeScraper.getTotalPages();
      totalPages = totalPagesResult;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      console.error("Scan failed", error);
      setError(error);
      setIsScanning(false);
      setProgress({ percent: 0, message: "", step: 1 });
      setScanResult({
        successCount: 0,
        skippedCachedCount: 0,
        updatedCount: 0,
        addedCount: 0,
        failedCount: 1,
      });
      return;
    }

    const allScannedAnimeMap = new Map<string, AnimeItem>();
    scannedListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));
    favoriteListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));
    trashListRef.current.forEach((x) => allScannedAnimeMap.set(x.link, x));

    const isScanRequired = (item: AnimeItem) => {
      // Skip scanning details if cached data is still valid and within cache duration
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

    let detailsCompletedCount = 0;
    let detailsTotalCount = 0;

    const updateProgress = (currentTitle: string) => {
      const detailsPercent =
        detailsTotalCount > 0 ? detailsCompletedCount / detailsTotalCount : 0;
      const rawPercent = Math.floor(detailsPercent * 99);
      const percent = Math.min(99, rawPercent);

      const msg = `Parsing (${detailsCompletedCount}/${detailsTotalCount})`;
      const finalMsg = `${msg} "${currentTitle}"`;
      setProgress({
        percent,
        message: finalMsg,
        step: 2,
      });
    };

    const pipelineOptions: ScannerOptions = {
      requestDelayMs: settings.requestDelayMs,
    };

    const pipeline = new AnimeScanner(
      totalPages,
      isScanRequired,
      animeScraper,
      pipelineOptions,
    );

    // Subscribe to the scan observable and keep reference for cancellation
    const subscription = pipeline.scan().subscribe({
      next: (event) => {
        if (event instanceof AnimeScanPageEvent) {
          const percent =
            event.totalPages > 0
              ? Math.round((event.currentPage / event.totalPages) * 100)
              : 0;
          setProgress({
            percent,
            message: `Loading anime index (${event.currentPage}/${event.totalPages})`,
            step: 1,
          });
          return;
        }

        if (event instanceof AnimeScanQueuedEvent) {
          detailsTotalCount++;
          return;
        }

        if (event instanceof AnimeScanSkippedEvent) {
          skippedCachedCount++;
          setScanResult({
            successCount,
            skippedCachedCount,
            updatedCount,
            addedCount,
            failedCount: 0,
          });
          return;
        }

        if (event instanceof Error) {
          return;
        }

        const item = event as AnimeItem;
        detailsCompletedCount++;
        updateProgress(item.title);

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
      complete: () => {
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
      },
      error: (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
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
