import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  percent: number;
  message: string;
}

export function ProgressBar({ percent, message }: ProgressBarProps) {
  const isStep1 =
    message.includes("Getting total pages") ||
    message.includes("list pages") ||
    message.includes("anime index");
  const isStep2 = !isStep1;

  // Parse page progress if available in Step 1
  const match = message.match(/\((\d+)\/(\d+)\)/);
  let step1Percent = 0;

  if (isStep1) {
    if (match) {
      const current = parseInt(match[1], 10);
      const total = parseInt(match[2], 10);
      if (total > 0) {
        step1Percent = Math.round((current / total) * 100);
      }
    }
  } else {
    // Step 2 is active, which means Step 1 is completed
    step1Percent = 100;
  }

  const step2Percent = isStep2 ? percent : 0;

  const displayMessage = message;

  return (
    <div className={styles.progressContainer} data-testid="progress-container">
      {displayMessage && (
        <div className={styles.statusText} data-testid="progress-status-text">
          {displayMessage}
        </div>
      )}

      <div className={styles.stepperContainer}>
        {/* Step 1 Progress Bar / Badge */}
        <div
          className={`${styles.step1} ${isStep2 ? styles.completed : styles.active}`}
          data-testid="step-circle-1"
        >
          {isStep2 ? (
            <span className={styles.checkmark} data-testid="check-1">
              ✓
            </span>
          ) : (
            <div
              className={styles.barInner}
              style={{
                width: `${step1Percent}%`,
                transition: step1Percent === 0 ? "none" : undefined,
              }}
              data-testid="step1-inner"
            />
          )}
        </div>

        {/* Step 2 Progress Bar / Inactive Capsule */}
        <div
          className={`${styles.step2} ${isStep2 ? styles.active : styles.inactive}`}
          data-testid="step-circle-2"
        >
          {isStep2 ? (
            <div
              className={styles.barInner}
              style={{
                width: `${step2Percent}%`,
                transition: step2Percent === 0 ? "none" : undefined,
              }}
              data-testid="step2-inner"
            />
          ) : (
            <div className={styles.inactiveDot} />
          )}
        </div>
      </div>
    </div>
  );
}
