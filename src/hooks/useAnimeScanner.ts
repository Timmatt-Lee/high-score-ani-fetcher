import { useState } from "react";
import { scraperService, type AnimeItem } from "../services/scraper";

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
      const totalPages = await scraperService.getTotalPages();

      const allItems = await scraperService.fetchAllWithConcurrency(
        totalPages,
        5,
        (percent, msg) => {
          setProgress({ percent, message: msg });
        },
      );

      setProgress({ percent: 100, message: "Fetching details..." });

      // Filter out trash and favorites, and filter by score & episode count
      const trashLinks = new Set(trash.map((t) => t.link));
      const favLinks = new Set(favorites.map((f) => f.link));

      const filteredItems = allItems.filter((item) => {
        if (trashLinks.has(item.link) || favLinks.has(item.link)) return false;
        if (isNaN(item.episode_count) || item.episode_count < 10) return false;
        if (item.title.includes("OVA")) return false;
        return true;
      });

      const chunk = <T>(arr: T[], size: number): T[][] => {
        const result = [];
        for (let i = 0; i < arr.length; i += size) {
          result.push(arr.slice(i, i + size));
        }
        return result;
      };

      const detailBatches = chunk(filteredItems, 5);
      const newItems: AnimeItem[] = [];

      for (const batch of detailBatches) {
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            setProgress((prev) => ({
              ...prev,
              message: `Fetching details for ${item.title}...`,
            }));
            const details = await scraperService.scrapeAnimeDetails(item.link);
            return details.score >= 4.8 ? { ...item, ...details } : null;
          }),
        );
        newItems.push(...(batchResults.filter(Boolean) as AnimeItem[]));
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
