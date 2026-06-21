import { useState, useEffect } from "react";
import { type Settings, SettingsSchema } from "../services/animeScanner";

const defaultSettings: Settings = {
  targetScore: 4.8,
  rescanThreshold: 95,
  cacheExpireDays: 14,
  requestDelayMs: 800,
};

const getStorage = () =>
  typeof chrome !== "undefined" && chrome.storage ? chrome.storage.local : null;

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const local = getStorage();
        const raw = local
          ? (await local.get(["settings"])).settings
          : JSON.parse(localStorage.getItem("settings") || "null");

        if (raw) {
          const parsed = SettingsSchema.safeParse(raw);
          if (parsed.success) {
            setSettings(parsed.data);
          }
        }
      } catch (err) {
        console.error("Failed to load settings", err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    try {
      setSettings(newSettings);
      const local = getStorage();
      if (local) {
        await local.set({ settings: newSettings });
      } else {
        localStorage.setItem("settings", JSON.stringify(newSettings));
      }
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  };

  return { settings, saveSettings, isLoaded };
}
