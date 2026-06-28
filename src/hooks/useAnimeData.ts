import { useState, useEffect } from "react";
import { z } from "zod";
import { type AnimeItem, AnimeItemSchema } from "../services/animeScanner";
import { serializeAnimeList } from "../utils/animeSerializer";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data on mount
  useEffect(() => {
    const parseList = (data: unknown): AnimeItem[] => {
      let cleanedData = data;
      if (Array.isArray(data)) {
        cleanedData = data.map((item) => {
          if (item && typeof item === "object") {
            const copy = { ...item };
            if (copy.scannedAt && !(copy.scannedAt instanceof Date)) {
              delete copy.scannedAt;
            }
            return copy;
          }
          return item;
        });
      }

      const result = z.array(AnimeItemSchema).safeParse(cleanedData);
      if (!result.success) {
        console.error("Zod parse error:", result.error, "Data was:", data);
        return [];
      }
      return result.data.map((item) => {
        if (item.score > 0 && !(item.scannedAt instanceof Date)) {
          return { ...item, scannedAt: new Date() };
        }
        return item;
      });
    };

    const loadData = async () => {
      try {
        if (
          typeof chrome !== "undefined" &&
          chrome.storage &&
          chrome.storage.local
        ) {
          const data = await chrome.storage.local.get([
            "searchList",
            "favoriteList",
            "trashList",
          ]);
          if (data.searchList) {
            setSearchList(parseList(data.searchList));
          }
          if (data.favoriteList) {
            setFavoriteList(parseList(data.favoriteList));
          }
          if (data.trashList) {
            setTrashList(parseList(data.trashList));
          }
        } else {
          // Fallback for local web dev without extension context
          const localData = localStorage.getItem("animeData");
          if (localData) {
            const parsed = JSON.parse(localData);
            if (parsed.searchList) {
              setSearchList(parseList(parsed.searchList));
            }
            if (parsed.favoriteList) {
              setFavoriteList(parseList(parsed.favoriteList));
            }
            if (parsed.trashList) {
              setTrashList(parseList(parsed.trashList));
            }
          }
        }
      } catch (err) {
        console.error("Failed to load data", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // Save data when state changes
  const saveData = async (s: AnimeItem[], f: AnimeItem[], t: AnimeItem[]) => {
    try {
      const payload = {
        searchList: serializeAnimeList(s),
        favoriteList: serializeAnimeList(f),
        trashList: serializeAnimeList(t),
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

  const moveToFavorites = (item: AnimeItem) => {
    const newSearch = searchList.filter((i) => i.link !== item.link);
    const newTrash = trashList.filter((i) => i.link !== item.link);
    const newFav = [...favoriteList, item];
    setSearchList(newSearch);
    setTrashList(newTrash);
    setFavoriteList(newFav);
    saveData(newSearch, newFav, newTrash);
  };

  const moveToTrash = (item: AnimeItem) => {
    const newSearch = searchList.filter((i) => i.link !== item.link);
    const newFav = favoriteList.filter((i) => i.link !== item.link);
    const newTrash = [...trashList, item];
    setSearchList(newSearch);
    setFavoriteList(newFav);
    setTrashList(newTrash);
    saveData(newSearch, newFav, newTrash);
  };

  return {
    searchList,
    setSearchList,
    favoriteList,
    setFavoriteList,
    trashList,
    setTrashList,
    moveToFavorites,
    moveToTrash,
    saveData,
    isLoaded,
  };
}
