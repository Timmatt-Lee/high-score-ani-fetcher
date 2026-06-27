import { useState } from "react";
import { z } from "zod";
import {
  type Settings,
  type AnimeItem,
  AnimeItemSchema,
} from "../../services/animeScanner";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
  searchList: AnimeItem[];
  favoriteList: AnimeItem[];
  trashList: AnimeItem[];
  onImportData: (data: {
    searchList: AnimeItem[];
    favoriteList: AnimeItem[];
    trashList: AnimeItem[];
  }) => void;
}

export function SettingsTab({
  settings,
  onSave,
  searchList,
  favoriteList,
  trashList,
  onImportData,
}: SettingsTabProps) {
  const [statusMsg, setStatusMsg] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);

  const handleChange = (key: keyof Settings, value: string) => {
    if (value.trim() === "") return;
    let num = Number(value);
    if (isNaN(num)) return;
    if (key === "targetScore") {
      num = Math.max(0.0, Math.min(5.0, num));
    } else if (key === "rescanThreshold") {
      num = Math.max(0, Math.min(100, num));
    }
    onSave({ ...settings, [key]: num });
  };

  const handleExport = () => {
    try {
      const serializeList = (list: AnimeItem[]) =>
        list.map((item) => ({
          ...item,
          uploadDate: item.uploadDate.toISOString(),
          scannedAt:
            item.scannedAt instanceof Date
              ? item.scannedAt.toISOString()
              : item.scannedAt,
        }));

      const backupData = {
        version: 1,
        searchList: serializeList(searchList),
        favoriteList: serializeList(favoriteList),
        trashList: serializeList(trashList),
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `high-score-ani-fetcher-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg({ text: "Backup exported successfully!", isError: false });
    } catch (err) {
      console.error(err);
      setStatusMsg({ text: "Failed to export backup data", isError: true });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result;
        if (typeof text !== "string") {
          throw new Error("Invalid file content");
        }
        const parsed = JSON.parse(text);

        const parseList = (listData: unknown): AnimeItem[] => {
          const schemaResult = z.array(AnimeItemSchema).safeParse(listData);
          if (!schemaResult.success) {
            throw new Error("Data schema validation failed");
          }
          return schemaResult.data.map((item) => ({
            ...item,
            uploadDate: new Date(item.uploadDate),
            scannedAt: item.scannedAt ? new Date(item.scannedAt) : undefined,
          }));
        };

        const importedSearch = parseList(parsed.searchList || []);
        const importedFavorites = parseList(parsed.favoriteList || []);
        const importedTrash = parseList(parsed.trashList || []);

        onImportData({
          searchList: importedSearch,
          favoriteList: importedFavorites,
          trashList: importedTrash,
        });

        setStatusMsg({ text: "Backup restored successfully!", isError: false });
      } catch (err: unknown) {
        console.error(err);
        const errorMsg = err instanceof Error ? err.message : String(err);
        setStatusMsg({
          text: errorMsg || "Failed to parse or validate backup file",
          isError: true,
        });
      }
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
        {statusMsg && (
          <span
            className={`${styles.statusMsg} ${
              statusMsg.isError ? styles.statusError : styles.statusSuccess
            }`}
            data-testid="backup-status-msg"
          >
            {statusMsg.text}
          </span>
        )}
      </div>
    </div>
  );
}
