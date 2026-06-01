import { useState } from "react";
import {
  type AnimeItem,
  type ScanCompleteResult,
  type PipelineOptions,
} from "../types/anime";
import { useServices } from "../contexts/ServiceContext";
import {
  ScraperHttpError,
  ScraperParseError,
  ScraperUnknownError,
  ScraperError,
  ScraperScanStep,
} from "../services/scraper";
import { isError } from "../types/result";

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
  const [error, setError] = useState<ScraperError | null>(null);
  const [totalPagesCount, setTotalPagesCount] = useState(0);
  const [failedDetails, setFailedDetails] = useState<AnimeItem[]>([]);

  const clearError = () => {
    setError(null);
  };

  const handleScan = async (options?: PipelineOptions) => {
    setHttpErrors([]);
    setParseErrors([]);
    setFailedDetails([]);
    setError(null);
    setIsScanning(true);

    const isRetry = !!(
      options &&
      (options.failedPages || options.failedDetails)
    );
    let totalPages = totalPagesCount;

    if (!isRetry) {
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
          setError(error);
        } else if (error instanceof ScraperParseError) {
          setError(error);
        } else if (error instanceof ScraperUnknownError) {
          setError(error);
        } else {
          setError(
            new ScraperUnknownError(
              error,
              1,
              ScraperScanStep.PAGINATION,
              "https://ani.gamer.com.tw/animeList.php?page=1",
              undefined,
            ),
          );
        }
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
      // If retrying, we might have fewer pages to scan
      const pagesToScanCount =
        isRetry && options.failedPages
          ? options.failedPages.length
          : totalPages;
      const pagesPercent =
        pagesToScanCount > 0 ? pagesCompletedCount / pagesToScanCount : 0;
      const detailsPercent =
        detailsTotalCount > 0 ? detailsCompletedCount / detailsTotalCount : 0;
      const rawPercent = Math.floor(
        (pagesPercent * 0.3 + detailsPercent * 0.7) * 100,
      );
      const percent = Math.min(99, rawPercent);

      let msg = `Scanning pages (${pagesCompletedCount}/${pagesToScanCount})`;
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
      .scanAllWithPipeline(
        totalPages,
        5,
        10,
        wrappedFilterItem,
        isRetry ? options : undefined,
      )
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
                failedDetails: scanFailedDetails,
              } = event.result;

              const mergedItemsMap = new Map<string, AnimeItem>();
              if (isRetry) {
                // Pre-populate with previous results when retrying
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

              // Overwrite or add newly retrieved anime items
              for (const item of items) {
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
              setFailedDetails(scanFailedDetails ?? []);
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
          if (error instanceof ScraperError) {
            setError(error);
          } else {
            setError(
              new ScraperUnknownError(
                error,
                1,
                ScraperScanStep.PAGINATION,
                "unknown",
                undefined,
              ),
            );
          }
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
    failedDetails,
  };
}
