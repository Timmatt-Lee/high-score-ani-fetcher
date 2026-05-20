import { useState } from "react";
import { ScraperService, type AnimeItem } from "../services/scraper";

export function useAnimeScanner(
  favorites: AnimeItem[],
  trash: AnimeItem[],
  onScanComplete: (newItems: AnimeItem[]) => void,
) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: "" });

  const handleScan = async () => {
    setIsScanning(true);
    setProgress({ percent: 0, message: "Getting total pages..." });

    try {
      const totalPages = await ScraperService.getTotalPages();

      const allItems = await ScraperService.fetchAllWithConcurrency(
        totalPages,
        5,
        (percent, msg) => {
          setProgress({ percent, message: msg });
        },
      );

      setProgress({ percent: 100, message: "Fetching details..." });

      // Filter out trash and favorites, and filter by score & episode count
      const newItems: AnimeItem[] = [];
      const trashLinks = new Set(trash.map((t) => t.link));
      const favLinks = new Set(favorites.map((f) => f.link));

      for (const item of allItems) {
        if (trashLinks.has(item.link) || favLinks.has(item.link)) continue;

        const epCount = parseInt(item.episode_count, 10);
        if (isNaN(epCount) || epCount < 10) continue; // Episode threshold
        if (item.title.includes("OVA")) continue;

        setProgress({
          percent: 100,
          message: `Fetching details for ${item.title}...`,
        });

        const details = await ScraperService.scrapeAnimeDetails(item.link);
        if (details.score >= 4.8) {
          newItems.push({ ...item, ...details });
        }
      }

      onScanComplete(newItems);
    } catch (error) {
      console.error("Scan failed", error);
      setProgress({ percent: 0, message: "Scan failed" });
    } finally {
      setIsScanning(false);
      setProgress({ percent: 0, message: "" });
    }
  };

  return {
    isScanning,
    progress,
    handleScan,
  };
}
