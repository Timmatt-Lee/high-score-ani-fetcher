import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  isScanning: boolean;
  percent: number;
  message: string;
}

export function ProgressBar({
  isScanning,
  percent,
  message,
}: ProgressBarProps) {
  if (!isScanning) return null;

  return (
    <div className={styles.progressContainer} data-testid="progress-container">
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${percent}%` }}
          data-testid="progress-fill"
        ></div>
      </div>
      <div className={styles.statusText}>{message}</div>
    </div>
  );
}
