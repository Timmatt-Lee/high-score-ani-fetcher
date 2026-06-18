import { useState, useEffect } from "react";
import { type Settings, SettingsSchema } from "../services/animeScanner";

const defaultSettings: Settings = {
  targetScore: 4.8,
  rescanThreshold: 95,
  cacheExpireDays: 14,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        if (typeof chrome !== "undefined" && chrome.storage) {
          const data = await chrome.storage.local.get(["settings"]);
          if (data.settings) {
            const parsed = SettingsSchema.safeParse(data.settings);
            if (parsed.success) {
              setSettings(parsed.data);
            }
          }
        } else {
          const localData = localStorage.getItem("settings");
          if (localData) {
            const parsed = SettingsSchema.safeParse(JSON.parse(localData));
            if (parsed.success) {
              setSettings(parsed.data);
            }
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
      if (typeof chrome !== "undefined" && chrome.storage) {
        await chrome.storage.local.set({ settings: newSettings });
      } else {
        localStorage.setItem("settings", JSON.stringify(newSettings));
      }
    } catch (err) {
      console.error("Failed to save settings", err);
    }
  };

  return { settings, saveSettings, isLoaded };
}
