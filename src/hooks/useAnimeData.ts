import { useState, useEffect } from "react";
import { type AnimeItem } from "../types/anime";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);

  // Load data on mount
  useEffect(() => {
    const reviveData = (data: AnimeItem[]): AnimeItem[] =>
      data.map((item) => ({
        ...item,
        uploadDate: new Date(item.uploadDate),
      }));

    const loadData = async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          const data = await chrome.storage.local.get([
            "searchList",
            "favorites",
            "trash",
          ]);
          if (Array.isArray(data.searchList)) {
            setSearchList(reviveData(data.searchList as AnimeItem[]));
          }
          if (Array.isArray(data.favorites)) {
            setFavoriteList(reviveData(data.favorites as AnimeItem[]));
          }
          if (Array.isArray(data.trash)) {
            setTrashList(reviveData(data.trash as AnimeItem[]));
          }
        } else {
          // Fallback for local web dev without extension context
          const localData = localStorage.getItem("animeData");
          if (localData) {
            const parsed = JSON.parse(localData);
            setSearchList(reviveData((parsed.searchList || []) as AnimeItem[]));
            setFavoriteList(
              reviveData((parsed.favorites || []) as AnimeItem[]),
            );
            setTrashList(reviveData((parsed.trash || []) as AnimeItem[]));
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
