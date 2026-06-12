import { useState } from "react";
import { useServices } from "../contexts/ServiceContext";
import {
  ScraperHttpError,
  ScraperParseError,
  ScanEventType,
  ScraperPipeline,
  type PipelineOptions,
  type AnimeItem,
} from "../services/scraper";
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
  const { scraperService } = useServices();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [httpErrors, setHttpErrors] = useState<ScraperHttpError[]>([]);
  const [parseErrors, setParseErrors] = useState<ScraperParseError[]>([]);
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
      try {
        const totalPagesResult = await scraperService.getTotalPages();
        const isResultError =
          isError(totalPagesResult) || typeof totalPagesResult !== "number";
        if (isResultError) {
          const error = isError(totalPagesResult)
            ? totalPagesResult
            : new Error(String(totalPagesResult));
          console.error("Scan failed", error);
          setError(error);
          setIsScanning(false);
          setProgress({ percent: 0, message: "" });
          return;
        }
        totalPages = totalPagesResult;
        setTotalPagesCount(totalPagesResult);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        setIsScanning(false);
        setProgress({ percent: 0, message: "" });
        return;
      }
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

    const wrappedFilterItem = (item: AnimeItem) => {
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

      let msg = "Scanning...";
      if (detailsTotalCount > 0) {
        msg = `Scanning details (${detailsCompletedCount}/${detailsTotalCount})`;
      }
      if (currentTitle) {
        msg += `... [${currentTitle}]`;
      } else {
        msg += "...";
      }

      setProgress({ percent, message: msg });
    };

    try {
      const pipeline = new ScraperPipeline(
        totalPages,
        5,
        10,
        wrappedFilterItem,
        scraperService,
        isRetry ? options : undefined,
      );

      pipeline.execute().subscribe({
        next: (event) => {
          switch (event.type) {
            case ScanEventType.ANIME_DETAIL:
              detailsCompletedCount++;
              updateProgress(event.title);
              break;
            case ScanEventType.COMPLETED: {
              const {
                animeItems,
                httpErrors: scanHttpErrors,
                parseErrors: scanParseErrors,
              } = event.result;

              const mergedItemsMap = new Map<string, AnimeItem>();
              if (isRetry) {
                searchList.forEach((item) =>
                  mergedItemsMap.set(item.link, item),
                );
                favoriteList.forEach((item) =>
                  mergedItemsMap.set(item.link, item),
                );
                trashList.forEach((item) =>
                  mergedItemsMap.set(item.link, item),
                );
              }

              for (const item of animeItems) {
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

              setHttpErrors(scanHttpErrors);
              setParseErrors(scanParseErrors);
              onScanComplete({
                newSearchItems: filteredNewItems,
                updatedFavoriteList,
                updatedTrashList,
              });
              setIsScanning(false);
              setProgress({ percent: 100, message: "Done!" });
              break;
            }
            default: {
              const _exhaustiveCheck: never = event;
              return _exhaustiveCheck;
            }
          }
        },
        error: (err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          setError(error);
          setIsScanning(false);
          setProgress({ percent: 0, message: "" });
        },
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsScanning(false);
      setProgress({ percent: 0, message: "" });
    }
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
