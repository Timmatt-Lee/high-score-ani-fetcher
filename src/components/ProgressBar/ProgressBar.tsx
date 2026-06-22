import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  percent: number;
  message: string;
}

export function ProgressBar({ percent, message }: ProgressBarProps) {
  return (
    <div className={styles.progressContainer} data-testid="progress-container">
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${percent}%` }}
          data-testid="progress-fill"
        ></div>
        <div className={styles.statusText}>{message}</div>
      </div>
    </div>
  );
}
