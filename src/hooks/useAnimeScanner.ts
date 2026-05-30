import { useState } from "react";
import { type AnimeItem, type ScanCompleteResult } from "../types/anime";
import { useServices } from "../contexts/ServiceContext";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
} from "../errors";
import { isError } from "../types/result";

export type FatalError =
  | ScraperHttpError
  | ScraperParseError
  | ScraperUnknownError;

export function useAnimeScanner(
  favoriteList: AnimeItem[],
  trashList: AnimeItem[],
  onScanComplete: (result: ScanCompleteResult) => void,
) {
  const { scraperService } = useServices();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [httpErrors, setHttpErrors] = useState<ScraperHttpError[]>([]);
  const [parseErrors, setParseErrors] = useState<ScraperParseError[]>([]);
  const [fatalError, setFatalError] = useState<FatalError | null>(null);

  const clearFatalError = () => {
    setFatalError(null);
  };

  const handleScan = async () => {
    setHttpErrors([]);
    setParseErrors([]);
    setFatalError(null);
    setIsScanning(true);
    setProgress({ percent: 0, message: "Getting total pages..." });

    const totalPagesResult = await scraperService.getTotalPages();
    const isResultError =
      isError(totalPagesResult) || typeof totalPagesResult !== "number";
    if (isResultError) {
      const error = isError(totalPagesResult)
        ? totalPagesResult
        : new Error(String(totalPagesResult));
      console.error("Scan failed", error);
      if (error instanceof ScraperHttpError) {
        setFatalError(error);
      } else if (error instanceof ScraperParseError) {
        setFatalError(error);
      } else if (error instanceof ScraperUnknownError) {
        setFatalError(error);
      } else {
        setFatalError(new ScraperUnknownError(error));
      }
      setIsScanning(false);
      setProgress({ percent: 0, message: "" });
      return;
    }
    const totalPages = totalPagesResult;

    const trashLinks = new Set(trashList.map((t) => t.link));
    const favLinks = new Set(favoriteList.map((f) => f.link));

    const filterItem = (item: AnimeItem) => {
      if (trashLinks.has(item.link) || favLinks.has(item.link)) return true;
      if (isNaN(item.episodeCount) || item.episodeCount < 10) return false;
      if (item.title.includes("OVA")) return false;
      return true;
    };

    let pagesCompletedCount = 0;
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
      const pagesPercent =
        totalPages > 0 ? pagesCompletedCount / totalPages : 0;
      const detailsPercent =
        detailsTotalCount > 0 ? detailsCompletedCount / detailsTotalCount : 0;
      const rawPercent = Math.floor(
        (pagesPercent * 0.3 + detailsPercent * 0.7) * 100,
      );
      const percent = Math.min(99, rawPercent);

      let msg = `Scanning pages (${pagesCompletedCount}/${totalPages})`;
      if (detailsTotalCount > 0) {
        msg += ` and details (${detailsCompletedCount}/${detailsTotalCount})`;
      }
      if (currentTitle) {
        msg += `... [${currentTitle}]`;
      } else {
        msg += "...";
      }

      setProgress({ percent, message: msg });
    };

    scraperService
      .scanAllWithPipeline(totalPages, 5, 10, wrappedFilterItem)
      .subscribe({
        next: (event) => {
          switch (event.type) {
            case "page_completed":
              pagesCompletedCount++;
              updateProgress();
              break;
            case "detail_completed":
              detailsCompletedCount++;
              updateProgress(event.title);
              break;
            case "completed": {
              const {
                items,
                httpErrors: scanHttpErrors,
                parseErrors: scanParseErrors,
              } = event.result;

              const updatedFavMap = new Map<string, AnimeItem>();
              const updatedTrashMap = new Map<string, AnimeItem>();
              const newItems: AnimeItem[] = [];

              for (const item of items) {
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
          }
        },
        error: (err: unknown) => {
          const error = err instanceof Error ? err : new Error(String(err));
          setFatalError(new ScraperUnknownError(error));
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
    fatalError,
    clearFatalError,
    handleScan,
  };
}
