import { type Settings } from "../../services/animeScanner";
import styles from "./SettingsTab.module.css";

interface SettingsTabProps {
  settings: Settings;
  onSave: (settings: Settings) => void;
}

export function SettingsTab({ settings, onSave }: SettingsTabProps) {
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

  return (
    <div className={styles.container} data-testid="settings-tab">
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
    </div>
  );
}
