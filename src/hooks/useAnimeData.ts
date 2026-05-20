import { useState, useEffect } from "react";
import { type AnimeItem } from "../services/scraper";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favorites, setFavorites] = useState<AnimeItem[]>([]);
  const [trash, setTrash] = useState<AnimeItem[]>([]);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          const data = await chrome.storage.local.get([
            "searchList",
            "favorites",
            "trash",
          ]);
          if (data.searchList) setSearchList(data.searchList as AnimeItem[]);
          if (data.favorites) setFavorites(data.favorites as AnimeItem[]);
          if (data.trash) setTrash(data.trash as AnimeItem[]);
        } else {
          // Fallback for local web dev without extension context
          const localData = localStorage.getItem("animeData");
          if (localData) {
            const parsed = JSON.parse(localData);
            setSearchList(parsed.searchList || []);
            setFavorites(parsed.favorites || []);
            setTrash(parsed.trash || []);
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
    const newFav = [...favorites, item];
    setSearchList(newSearch);
    setFavorites(newFav);
    saveData(newSearch, newFav, trash);
  };

  const moveToTrash = (item: AnimeItem) => {
    const newSearch = searchList.filter((i) => i.link !== item.link);
    const newFav = favorites.filter((i) => i.link !== item.link);
    const newTrash = [...trash, item];
    setSearchList(newSearch);
    setFavorites(newFav);
    setTrash(newTrash);
    saveData(newSearch, newFav, newTrash);
  };

  const restoreFromTrash = (item: AnimeItem) => {
    const newTrash = trash.filter((i) => i.link !== item.link);
    const newSearch = [...searchList, item];
    setTrash(newTrash);
    setSearchList(newSearch);
    saveData(newSearch, favorites, newTrash);
  };

  return {
    searchList,
    setSearchList,
    favorites,
    trash,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  };
}
