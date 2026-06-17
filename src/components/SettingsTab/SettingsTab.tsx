import { useState } from "react";
import type { Settings } from "../../types/settings";
import "../../index.css";

interface SettingsTabProps {
  settings: Settings;
  onSaveSettings: (newSettings: Settings) => void;
}

export const SettingsTab = ({ settings, onSaveSettings }: SettingsTabProps) => {
  const [localSettings, setLocalSettings] = useState<Settings>(settings);
  const [prevSettings, setPrevSettings] = useState<Settings>(settings);

  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setLocalSettings(settings);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let numValue = parseFloat(value);

    // Convert percentage back to ratio for storage
    if (name === "rescanThresholdRatio") {
      numValue = numValue / 100;
    }

    setLocalSettings((prev) => ({
      ...prev,
      [name]: isNaN(numValue) ? prev[name as keyof Settings] : numValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(localSettings);
    // Visual feedback
    const btn = document.getElementById("save-settings-btn");
    if (btn) {
      const originalText = btn.innerText;
      btn.innerText = "Saved!";
      setTimeout(() => {
        btn.innerText = originalText;
      }, 2000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--background)] text-[var(--foreground)] p-6 overflow-y-auto">
      <h2 className="text-2xl font-bold mb-6 text-[var(--primary)]">
        Settings
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-md">
        <div className="flex flex-col gap-2">
          <label htmlFor="targetScore" className="font-semibold">
            Target Score
          </label>
          <p className="text-sm text-[var(--foreground)] opacity-70">
            The minimum score you consider "good". Only anime above this score
            will be shown.
          </p>
          <input
            id="targetScore"
            name="targetScore"
            type="number"
            min="0"
            max="5"
            step="0.1"
            value={localSettings.targetScore}
            onChange={handleChange}
            className="p-2 border border-[var(--border)] rounded bg-[var(--card)] text-[var(--foreground)]"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="rescanThresholdRatio" className="font-semibold">
            Rescan Threshold Ratio (%)
          </label>
          <p className="text-sm text-[var(--foreground)] opacity-70">
            Anime with scores below this percentage of the Target Score will be
            permanently skipped to save time. (e.g. 95% of 4.8 = 4.56).
          </p>
          <input
            id="rescanThresholdRatio"
            name="rescanThresholdRatio"
            type="number"
            min="0"
            max="100"
            step="1"
            value={Math.round(localSettings.rescanThresholdRatio * 100)}
            onChange={handleChange}
            className="p-2 border border-[var(--border)] rounded bg-[var(--card)] text-[var(--foreground)]"
            required
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="cacheExpireDays" className="font-semibold">
            Cache Expire Days
          </label>
          <p className="text-sm text-[var(--foreground)] opacity-70">
            How many days to wait before refetching an anime's details. Set to 0
            to always refetch eligible anime.
          </p>
          <input
            id="cacheExpireDays"
            name="cacheExpireDays"
            type="number"
            min="0"
            step="1"
            value={localSettings.cacheExpireDays}
            onChange={handleChange}
            className="p-2 border border-[var(--border)] rounded bg-[var(--card)] text-[var(--foreground)]"
            required
          />
        </div>

        <button
          id="save-settings-btn"
          type="submit"
          className="mt-4 p-3 bg-[var(--primary)] text-white font-bold rounded hover:bg-opacity-90 transition-colors"
        >
          Save Settings
        </button>
      </form>
    </div>
  );
};
