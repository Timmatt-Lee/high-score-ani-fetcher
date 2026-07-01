import type { ChangeEvent } from "react";
import { z } from "zod";
import { type Settings, SettingsSchema } from "../../types/settings";
import { type AnimeItem, AnimeItemSchema } from "../../services/animeScanner";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  scannedList: AnimeItem[];
  favoriteList: AnimeItem[];
  trashList: AnimeItem[];
  onImportData: (data: {
    scannedList: AnimeItem[];
    favoriteList: AnimeItem[];
    trashList: AnimeItem[];
  }) => void;
  onError: (error: Error) => void;
}

export function SettingsTab({
  settings,
  onSave,
  scannedList,
  favoriteList,
  trashList,
  onImportData,
  onError,
}: SettingsTabProps) {
  const handleChange = (key: keyof Settings, value: string) => {
    if (value.trim() === "") return;
    const num = Number(value);
    if (isNaN(num)) return;

    const parsed = SettingsSchema.parse({ ...settings, [key]: num });
    onSave(parsed);
  };
  const handleExport = () => {
    const backupData = {
      version: 1,
      scannedList,
      favoriteList,
      trashList,
    };

    let url: string;
    try {
      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      url = URL.createObjectURL(blob);
    } catch (err) {
      console.error(err);
      onError(new Error("Failed to export backup data", { cause: err }));
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = `high-score-ani-fetcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text !== "string") {
        onError(new Error("Invalid file content"));
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        console.error(err);
        onError(
          new Error("Failed to parse or validate backup file", { cause: err }),
        );
        return;
      }

      const backupObj = parsed as Record<string, unknown>;

      const parseList = (list: unknown) => z.array(AnimeItemSchema).parse(list);

      let importedScanned: AnimeItem[];
      let importedFavorites: AnimeItem[];
      let importedTrash: AnimeItem[];

      try {
        importedScanned = parseList(
          backupObj.scannedList || backupObj.searchList || [],
        );
        importedFavorites = parseList(backupObj.favoriteList || []);
        importedTrash = parseList(backupObj.trashList || []);
      } catch (err) {
        console.error(err);
        let errMsg: string;
        if (err instanceof z.ZodError) {
          errMsg = "Data schema validation failed";
        } else if (err instanceof Error) {
          errMsg = err.message;
        } else {
          errMsg = String(err);
        }
        onError(
          new Error(errMsg, {
            cause: err,
          }),
        );
        return;
      }

      onImportData({
        scannedList: importedScanned,
        favoriteList: importedFavorites,
        trashList: importedTrash,
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.settingsGrid} data-testid="settings-tab">
      <div className={styles.settingGroup}>
        <div className={styles.textGroup}>
          <label className={styles.label}>Target Score (e.g. 4.8)</label>
          <span className={styles.description}>
            Animes with a score equal to or above this will be shown in the
            Search results.
          </span>
        </div>
        <input
          type="number"
          step="0.1"
          min="0.0"
          max="5.0"
          className={styles.input}
          value={settings.targetScore}
          onChange={(e) => handleChange("targetScore", e.target.value)}
        />
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.textGroup}>
          <label className={styles.label}>Rescan Threshold</label>
          <span className={styles.description}>
            If an anime's previous score is below (Target Score * Threshold), it
            won't be re-fetched. (e.g. 95)
          </span>
        </div>
        <div className={styles.inputWrapper}>
          <input
            type="number"
            step="1"
            min="0"
            max="100"
            className={styles.input}
            value={settings.rescanThreshold}
            onChange={(e) => handleChange("rescanThreshold", e.target.value)}
          />
          <span className={styles.suffix}>%</span>
        </div>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.textGroup}>
          <label className={styles.label}>Cache Expire Days</label>
          <span className={styles.description}>
            How many days before an anime's detail page is fetched again. (0 =
            always fetch)
          </span>
        </div>
        <input
          type="number"
          step="1"
          min="0"
          className={styles.input}
          value={settings.cacheExpireDays}
          onChange={(e) => handleChange("cacheExpireDays", e.target.value)}
        />
      </div>
      <div className={styles.settingGroup}>
        <div className={styles.textGroup}>
          <label className={styles.label}>Request Delay (ms)</label>
          <span className={styles.description}>
            Minimum delay between each HTTP request to avoid rate limiting.
            Default 800 ms.
          </span>
        </div>
        <input
          type="number"
          step="50"
          min="0"
          className={styles.input}
          value={settings.requestDelayMs}
          onChange={(e) => handleChange("requestDelayMs", e.target.value)}
        />
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.textGroup}>
          <label className={styles.label}>Backup & Restore</label>
          <span className={styles.description}>
            Export your current scanned anime lists and preferences to a backup
            JSON file or restore them from one.
          </span>
        </div>
        <div className={styles.backupActions}>
          <button
            type="button"
            className={styles.backupBtn}
            onClick={handleExport}
            data-testid="btn-export-backup"
          >
            Export Backup
          </button>
          <label
            className={styles.backupBtn}
            data-testid="btn-import-backup-label"
          >
            Import Backup
            <input
              type="file"
              accept=".json"
              className={styles.fileInput}
              onChange={handleImport}
              data-testid="file-import-input"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
