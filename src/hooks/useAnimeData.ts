import { useState, useEffect } from "react";
import { z } from "zod";
import {
  type AnimeItem,
  AnimeItemSchema,
  type AnimeCacheItem,
} from "../services/animeScanner";
import {
  type Settings,
  SettingsSchema,
  DEFAULT_SETTINGS,
} from "../types/settings";

export function useAnimeData() {
  const [searchList, setSearchList] = useState<AnimeItem[]>([]);
  const [favoriteList, setFavoriteList] = useState<AnimeItem[]>([]);
  const [trashList, setTrashList] = useState<AnimeItem[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [animeCache, setAnimeCache] = useState<Record<string, AnimeCacheItem>>(
    {},
  );

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
            "settings",
            "animeCache",
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
          if (data.settings) {
            const result = SettingsSchema.safeParse(data.settings);
            if (result.success) {
              setSettings(result.data);
            }
          }
          if (data.animeCache) {
            setAnimeCache(data.animeCache as Record<string, AnimeCacheItem>);
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
            if (parsed.settings) {
              const result = SettingsSchema.safeParse(parsed.settings);
              if (result.success) {
                setSettings(result.data);
              }
            }
            if (parsed.animeCache) {
              setAnimeCache(parsed.animeCache);
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
  const saveData = async (
    s: AnimeItem[],
    f: AnimeItem[],
    t: AnimeItem[],
    c: Record<string, AnimeCacheItem> = animeCache,
    set: Settings = settings,
  ) => {
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
        settings: set,
        animeCache: c,
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

  // Helper function for UI to save settings and also trigger saveData
  const updateSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    saveData(searchList, favoriteList, trashList, animeCache, newSettings);
  };

  return {
    searchList,
    setSearchList,
    favoriteList,
    setFavoriteList,
    trashList,
    setTrashList,
    settings,
    setSettings: updateSettings,
    animeCache,
    setAnimeCache,
    moveToFavorites,
    moveToTrash,
    restoreFromTrash,
    saveData,
  };
}
