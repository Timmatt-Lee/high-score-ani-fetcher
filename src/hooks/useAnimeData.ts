import { useState, useEffect } from "react";
import { z } from "zod";
import { type AnimeItem, AnimeItemSchema } from "../services/animeScanner";

export function useAnimeData() {
  const [scannedList, setScannedList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data on mount
  useEffect(() => {
    const parseList = (data: unknown): AnimeItem[] => {
      if (!Array.isArray(data)) {
        console.error("Loaded data is not an array");
        return [];
      }

      const result = z.array(AnimeItemSchema).safeParse(data);
      if (!result.success) {
        console.error("Zod parse error:", result.error, "Data was:", data);
        return [];
      }

      return result.data;
    };

    const loadData = async () => {
      let rawData: Record<string, unknown> = {};

      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        try {
          rawData = await chrome.storage.local.get([
            "scannedList",
            "searchList",
            "favoriteList",
            "trashList",
          ]);
          // Migration: fallback to searchList if scannedList is empty/undefined
          if (rawData.searchList && !rawData.scannedList) {
            rawData.scannedList = rawData.searchList;
          }
        } catch (err) {
          console.error("Failed to load data", err);
        }
      } else {
        // Fallback for local web dev without extension context
        let localData: string | null = null;
        try {
          localData = localStorage.getItem("animeData");
        } catch (err) {
          console.error("Failed to load data", err);
        }

        if (localData) {
          try {
            rawData = JSON.parse(localData);
            // Migration fallback
            if (rawData.searchList && !rawData.scannedList) {
              rawData.scannedList = rawData.searchList;
            }
          } catch (err) {
            console.error("Failed to load data", err);
          }
        }
      }

      if (rawData.scannedList) {
        setScannedList(parseList(rawData.scannedList));
      }
      if (rawData.favoriteList) {
        setFavoriteList(parseList(rawData.favoriteList));
      }
      if (rawData.trashList) {
        setTrashList(parseList(rawData.trashList));
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  // Save data when state changes
  const saveData = async (s: AnimeItem[], f: AnimeItem[], t: AnimeItem[]) => {
    try {
      const payload = {
        scannedList: s,
        favoriteList: f,
        trashList: t,
      };

      if (
        typeof chrome !== "undefined" &&
        chrome.storage &&
        chrome.storage.local
      ) {
        await chrome.storage.local.set(payload);
      } else {
        localStorage.setItem("animeData", JSON.stringify(payload));
      }
    } catch (err) {
      console.error("Failed to save data", err);
    }
  };

  const updateLists = (s: AnimeItem[], f: AnimeItem[], t: AnimeItem[]) => {
    setScannedList(s);
    setFavoriteList(f);
    setTrashList(t);
    saveData(s, f, t);
  };

  const moveToFavorites = (item: AnimeItem) => {
    const newScanned = scannedList.filter((i) => i.link !== item.link);
    const newTrash = trashList.filter((i) => i.link !== item.link);
    const newFav = [...favoriteList, item];
    updateLists(newScanned, newFav, newTrash);
  };

  const moveToTrash = (item: AnimeItem) => {
    const newScanned = scannedList.filter((i) => i.link !== item.link);
    const newFav = favoriteList.filter((i) => i.link !== item.link);
    const newTrash = [...trashList, item];
    updateLists(newScanned, newFav, newTrash);
  };

  return {
    scannedList,
    favoriteList,
    trashList,
    moveToFavorites,
    moveToTrash,
    updateLists,
    isLoaded,
  };
}
