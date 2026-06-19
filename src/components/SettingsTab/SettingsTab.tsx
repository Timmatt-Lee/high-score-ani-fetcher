import { type Settings } from "../../services/animeScanner";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsTab({ settings, onSave }: SettingsTabProps) {
  const handleChange = (key: keyof Settings, value: string) => {
    onSave({ ...settings, [key]: Number(value) });
  };

  return (
    <div className={styles.container} data-testid="settings-tab">
      <div className={styles.settingGroup}>
        <label className={styles.label}>Target Score (e.g. 4.8)</label>
        <span className={styles.description}>
          Animes with a score equal to or above this will be shown in the Search
          results.
        </span>
        <input
          type="number"
          step="0.1"
          className={styles.input}
          value={settings.targetScore}
          onChange={(e) => handleChange("targetScore", e.target.value)}
        />
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.label}>Rescan Threshold (%)</label>
        <span className={styles.description}>
          If an anime's previous score is below (Target Score * Threshold), it
          won't be re-fetched. (e.g. 95)
        </span>
        <input
          type="number"
          step="1"
          min="0"
          max="100"
          className={styles.input}
          value={settings.rescanThreshold}
          onChange={(e) => handleChange("rescanThreshold", e.target.value)}
        />
      </div>

      <div className={styles.settingGroup}>
        <label className={styles.label}>Cache Expire Days</label>
        <span className={styles.description}>
          How many days before an anime's detail page is fetched again. (0 =
          always fetch)
        </span>
        <input
          type="number"
          step="1"
          min="0"
          className={styles.input}
          value={settings.cacheExpireDays}
          onChange={(e) => handleChange("cacheExpireDays", e.target.value)}
        />
      </div>
    </div>
  );
}
