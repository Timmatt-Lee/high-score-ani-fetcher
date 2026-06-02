import { useState, useEffect } from "react";
import { z } from "zod";
import { type AnimeItem, AnimeItemSchema } from "../services/scraper";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);

  // Load data on mount
  useEffect(() => {
    const parseList = (data: unknown): AnimeItem[] => {
      const result = z.array(AnimeItemSchema).safeParse(data);
      if (!result.success) {
        console.error("Zod parse error:", result.error, "Data was:", data);
        return [];
      }
      return result.data;
    };

    const loadData = async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
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
      }
    };
    loadData();
  }, []);

  // Save data when state changes
  const saveData = async (s: AnimeItem[], f: AnimeItem[], t: AnimeItem[]) => {
    try {
      const serializeList = (list: AnimeItem[]) =>
        list.map((item) => ({
          ...item,
          uploadDate: item.uploadDate.toISOString(),
        }));

      const payload = {
        searchList: serializeList(s),
        favoriteList: serializeList(f),
        trashList: serializeList(t),
      };

      if (typeof chrome !== "undefined" && chrome.storage) {
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
    const newFav = [...favoriteList, item];
    setSearchList(newSearch);
    setFavoriteList(newFav);
    saveData(newSearch, newFav, trashList);
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

  const restoreFromTrash = (item: AnimeItem) => {
    const newTrash = trashList.filter((i) => i.link !== item.link);
    const newSearch = [...searchList, item];
    setTrashList(newTrash);
    setSearchList(newSearch);
    saveData(newSearch, favoriteList, newTrash);
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
    restoreFromTrash,
    saveData,
  };
}
