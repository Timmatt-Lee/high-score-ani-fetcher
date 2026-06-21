import { useState, useRef, useEffect } from "react";
import { useServices } from "../contexts/ServiceContext";
import { useSettings } from "./useSettings";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanner,
  type PipelineOptions,
  type AnimeItem,
  AnimeScanPageEvent,
} from "../services/animeScanner";
import { isError } from "../types/result";

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
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [httpErrors, setHttpErrors] = useState<AnimeScanHttpError[]>([]);
  const [parseErrors, setParseErrors] = useState<AnimeScanParseError[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [totalPagesCount, setTotalPagesCount] = useState(0);

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
    setHttpErrors([]);
    setParseErrors([]);
    setError(null);
    setIsScanning(true);

    const isRetry = !!(
      options &&
      options.onlyPages &&
      options.onlyPages.length > 0
    );
    let totalPages = totalPagesCount;

    if (!isRetry) {
      setProgress({ percent: 0, message: "Getting total pages..." });
      const totalPagesResult = await animeScraper.getTotalPages();
      if (isError(totalPagesResult)) {
        console.error("Scan failed", totalPagesResult);
        setError(totalPagesResult);
        setIsScanning(false);
        setProgress({ percent: 0, message: "" });
        return;
      }
      totalPages = totalPagesResult;
      setTotalPagesCount(totalPagesResult);
    } else {
      setProgress({ percent: 0, message: "Retrying failed items..." });
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
      const isKept = filterItem(item);
      if (isKept) {
        detailsTotalCount++;
      }
      return isKept;
    };

    const updateProgress = (currentTitle?: string) => {
      const detailsPercent =
        detailsTotalCount > 0 ? detailsCompletedCount / detailsTotalCount : 0;
      const rawPercent = Math.floor(detailsPercent * 99);
      const percent = Math.min(99, rawPercent);

      const actionPrefix = isRetry ? "Retrying failed items" : "Scanning";
      let msg = actionPrefix;
      if (detailsTotalCount > 0) {
        msg = `${actionPrefix} (${detailsCompletedCount}/${detailsTotalCount})`;
      }
      msg += "...";
      if (currentTitle) {
        msg += ` [${currentTitle}]`;
      }

      setProgress({ percent, message: msg });
    };

    const scanHttpErrors: AnimeScanHttpError[] = [];
    const scanParseErrors: AnimeScanParseError[] = [];

    const pipeline = new AnimeScanner(
      totalPages,
      filterAndCountItem,
      animeScraper,
      isRetry ? options : undefined,
    );

    pipeline.scan().subscribe({
      next: (event) => {
        if (event instanceof AnimeScanPageEvent) {
          const actionPrefix = isRetry
            ? "Retrying list pages"
            : "Fetching list pages";
          setProgress({
            percent: 0,
            message: `${actionPrefix} (${event.currentPage}/${event.totalPages})...`,
          });
        } else if (event instanceof AnimeScanHttpError) {
          scanHttpErrors.push(event);
          setHttpErrors([...scanHttpErrors]);
          updateProgress(event.animeName);
        } else if (event instanceof AnimeScanParseError) {
          scanParseErrors.push(event);
          setParseErrors([...scanParseErrors]);
          updateProgress(event.animeName);
        } else if (!(event instanceof Error)) {
          detailsCompletedCount++;
          updateProgress(event.title);

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

          if (!isUpdated && event.score >= 4.8) {
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
        setProgress({ percent: 100, message: "Done!" });
      },
      error: (err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsScanning(false);
        setProgress({ percent: 0, message: "" });
      },
    });
  };

  return {
    isScanning,
    progress,
    httpErrors,
    parseErrors,
    error,
    clearError,
    handleScan,
  };
}
