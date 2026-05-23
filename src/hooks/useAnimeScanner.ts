import { useState } from "react";
import { type AnimeItem } from "../types/anime";
import { useServices } from "../contexts/ServiceContext";
import { ScraperHttpError, ScraperParseError } from "../errors";

export function useAnimeScanner(
  favorites: AnimeItem[],
  trash: AnimeItem[],
  onScanComplete: (newItems: AnimeItem[]) => void,
) {
  const { scraperService } = useServices();
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });
  const [httpErrors, setHttpErrors] = useState<ScraperHttpError[]>([]);
  const [parseErrors, setParseErrors] = useState<ScraperParseError[]>([]);

  const handleScan = async () => {
    setHttpErrors([]);
    setParseErrors([]);
    setIsScanning(true);
    setProgress({ percent: 0, message: "Getting total pages..." });

    const totalPagesResult = await scraperService.getTotalPages();
    if (!totalPagesResult.isSuccess) {
      const error = totalPagesResult.error;
      console.error("Scan failed", error);
      setProgress({ percent: 0, message: "Scan failed" });
      if (error instanceof ScraperHttpError) {
        setHttpErrors([error]);
      } else if (error instanceof ScraperParseError) {
        setParseErrors([error]);
      } else {
        const errVal = error as unknown;
        setHttpErrors([
          new ScraperHttpError(
            "",
            errVal instanceof Error ? errVal.message : String(errVal),
            500,
          ),
        ]);
      }
      setIsScanning(false);
      setProgress({ percent: 0, message: "" });
      return;
    }
    const totalPages = totalPagesResult.value;

    try {
      const trashLinks = new Set(trash.map((t) => t.link));
      const favLinks = new Set(favorites.map((f) => f.link));

      const filterItem = (item: AnimeItem) => {
        if (trashLinks.has(item.link) || favLinks.has(item.link)) return false;
        if (isNaN(item.episodeCount) || item.episodeCount < 10) return false;
        if (item.title.includes("OVA")) return false;
        return true;
      };

      const scanResult = await scraperService.scanAllWithPipeline(
        totalPages,
        5,
        10,
        filterItem,
        (
          pagesCompleted,
          pagesTotal,
          detailsCompleted,
          detailsTotal,
          currentTitle,
        ) => {
          const pagesPercent = totalPages > 0 ? pagesCompleted / totalPages : 0;
          const detailsPercent =
            detailsTotal > 0 ? detailsCompleted / detailsTotal : 0;
          const rawPercent = Math.floor(
            (pagesPercent * 0.3 + detailsPercent * 0.7) * 100,
          );
          const percent = Math.min(99, rawPercent);

          let msg = `Scanning pages (${pagesCompleted}/${pagesTotal})`;
          if (detailsTotal > 0) {
            msg += ` and details (${detailsCompleted}/${detailsTotal})`;
          }
          if (currentTitle) {
            msg += `... [${currentTitle}]`;
          } else {
            msg += "...";
          }

          setProgress({ percent, message: msg });
        },
      );

      const detailedItems = scanResult.items;
      const scanHttpErrors = scanResult.errors.filter(
        (err): err is ScraperHttpError => err instanceof ScraperHttpError,
      );
      const scanParseErrors = scanResult.errors.filter(
        (err): err is ScraperParseError => err instanceof ScraperParseError,
      );

      const filteredItems = detailedItems.filter((item) => item.score >= 4.8);
      const sortedItems = filteredItems.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.title.localeCompare(b.title);
      });

      setHttpErrors(scanHttpErrors);
      setParseErrors(scanParseErrors);
      onScanComplete(sortedItems);
    } finally {
      setIsScanning(false);
      setProgress({ percent: 0, message: "" });
    }
  };

  return {
    isScanning,
    progress,
    httpErrors,
    parseErrors,
    handleScan,
  };
}
