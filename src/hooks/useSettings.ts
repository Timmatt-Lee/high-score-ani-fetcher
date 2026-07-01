import { useState, useEffect } from "react";
import { type Settings, SettingsSchema } from "../types/settings";

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
      const chromeStorage = getStorage();
      try {
        const raw: unknown = chromeStorage
          ? ((await chromeStorage.get(["settings"])).settings ?? null)
          : JSON.parse(localStorage.getItem("settings") ?? "null");

        if (raw) {
          const parsed = SettingsSchema.safeParse(raw);
          if (parsed.success) {
            setSettings(parsed.data);
          }
        }
      } catch (err) {
        console.error(
          chromeStorage
            ? "Failed to load settings from chrome.storage"
            : "Failed to load settings from localStorage",
          err,
        );
      } finally {
        setIsLoaded(true);
      }
    };

    void loadSettings();
  }, []);

  const saveSettings = async (newSettings: Settings) => {
    setSettings(newSettings);
    const chromeStorage = getStorage();
    if (chromeStorage) {
      try {
        await chromeStorage.set({ settings: newSettings });
      } catch (err) {
        console.error("Failed to save settings to chrome.storage", err);
      }
    } else {
      try {
        localStorage.setItem("settings", JSON.stringify(newSettings));
      } catch (err) {
        console.error("Failed to save settings to localStorage", err);
      }
    }
  };

  return { settings, saveSettings, isLoaded };
}
