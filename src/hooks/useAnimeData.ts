import { useState, useEffect } from "react";
import { z } from "zod";
import { type AnimeItem, AnimeItemSchema } from "../types/anime";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);

  // Load data on mount
  useEffect(() => {
    const parseList = (data: unknown): AnimeItem[] => {
      const result = z.array(AnimeItemSchema).safeParse(data);
      return result.success ? result.data : [];
    };

    const loadData = async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          const data = await chrome.storage.local.get([
            "searchList",
            "favorites",
            "trash",
          ]);
          if (data.searchList) {
            setSearchList(parseList(data.searchList));
          }
          if (data.favorites) {
            setFavoriteList(parseList(data.favorites));
          }
          if (data.trash) {
            setTrashList(parseList(data.trash));
          }
        } else {
          // Fallback for local web dev without extension context
          const localData = localStorage.getItem("animeData");
          if (localData) {
            const parsed = JSON.parse(localData);
            setSearchList(parseList(parsed.searchList));
            setFavoriteList(parseList(parsed.favorites));
            setTrashList(parseList(parsed.trash));
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
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({
          searchList: s,
          favorites: f,
          trash: t,
        });
      } else {
        localStorage.setItem(
          "animeData",
          JSON.stringify({ searchList: s, favorites: f, trash: t }),
        );
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
    trashList,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  };
}
