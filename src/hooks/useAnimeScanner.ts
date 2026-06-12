import { useState } from "react";
import { useServices } from "../contexts/ServiceContext";
import {
  AnimeScanHttpError,
  AnimeScanParseError,
  AnimeScanner,
  type PipelineOptions,
  type AnimeItem,
} from "../services/animeScanner";
import { isError } from "../types/result";

export interface ScanCompleteResult {
  newSearchItems: AnimeItem[];
  updatedFavoriteList: AnimeItem[];
  updatedTrashList: AnimeItem[];
}

export function useAnimeScanner(
  searchList: AnimeItem[],
  favoriteList: AnimeItem[],
  trashList: AnimeItem[],
  onScanComplete: (result: ScanCompleteResult) => void,
) {
  const { animeScraper } = useServices();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [httpErrors, setHttpErrors] = useState<AnimeScanHttpError[]>([]);
  const [parseErrors, setParseErrors] = useState<AnimeScanParseError[]>([]);
  const [error, setError] = useState<Error | null>(null);
  const [totalPagesCount, setTotalPagesCount] = useState(0);

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

    const trashLinks = new Set(trashList.map((t) => t.link));
    const favLinks = new Set(favoriteList.map((f) => f.link));

    const filterItem = (item: AnimeItem) => {
      if (trashLinks.has(item.link) || favLinks.has(item.link)) return true;
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

    const results: AnimeItem[] = [];
    const scanHttpErrors: AnimeScanHttpError[] = [];
    const scanParseErrors: AnimeScanParseError[] = [];

    const pipeline = new AnimeScanner(
      totalPages,
      5,
      10,
      filterAndCountItem,
      animeScraper,
      isRetry ? options : undefined,
    );

    pipeline.scan().subscribe({
      next: (event) => {
        if (event instanceof AnimeScanHttpError) {
          scanHttpErrors.push(event);
          setHttpErrors([...scanHttpErrors]);
          updateProgress(event.animeName);
        } else if (event instanceof AnimeScanParseError) {
          scanParseErrors.push(event);
          setParseErrors([...scanParseErrors]);
          updateProgress(event.animeName);
        } else if (!(event instanceof Error)) {
          results.push(event);
          detailsCompletedCount++;
          updateProgress(event.title);
        }
      },
      complete: () => {
        const mergedItemsMap = new Map<string, AnimeItem>();
        if (isRetry) {
          searchList.forEach((item) => mergedItemsMap.set(item.link, item));
          favoriteList.forEach((item) => mergedItemsMap.set(item.link, item));
          trashList.forEach((item) => mergedItemsMap.set(item.link, item));
        }

        for (const item of results) {
          mergedItemsMap.set(item.link, item);
        }

        const updatedFavMap = new Map<string, AnimeItem>();
        const updatedTrashMap = new Map<string, AnimeItem>();
        const newItems: AnimeItem[] = [];

        for (const item of mergedItemsMap.values()) {
          if (favLinks.has(item.link)) {
            updatedFavMap.set(item.link, item);
          } else if (trashLinks.has(item.link)) {
            updatedTrashMap.set(item.link, item);
          } else {
            newItems.push(item);
          }
        }

        const filteredNewItems = newItems
          .filter((item) => item.score >= 4.8)
          .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.title.localeCompare(b.title);
          });

        const updatedFavoriteList = favoriteList.map(
          (fav) => updatedFavMap.get(fav.link) ?? fav,
        );
        const updatedTrashList = trashList.map(
          (trash) => updatedTrashMap.get(trash.link) ?? trash,
        );

        onScanComplete({
          newSearchItems: filteredNewItems,
          updatedFavoriteList,
          updatedTrashList,
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
