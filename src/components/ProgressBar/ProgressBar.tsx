import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  stepsCount: number; // Total number of steps
  currentStepIndex: number; // 0-indexed active step index
  currentStepPercent: number; // 0-100 percentage for the active step
  message: string; // Status message to display
}

export function ProgressBar({
  stepsCount,
  currentStepIndex,
  currentStepPercent,
  message,
}: ProgressBarProps) {
  // Generate step structures dynamically based on stepsCount
  const steps = Array.from({ length: stepsCount }, (_, i) => {
    const isCompleted = i < currentStepIndex;
    const isActive = i === currentStepIndex;
    const isInactive = i > currentStepIndex;

    // Percent completed inside this specific step capsule
    const percent = isCompleted ? 100 : isActive ? currentStepPercent : 0;

    return {
      index: i,
      isCompleted,
      isActive,
      isInactive,
      percent,
    };
  });

  return (
    <div className={styles.progressContainer} data-testid="progress-container">
      {message && (
        <div className={styles.statusText} data-testid="progress-status-text">
          {message}
        </div>
      )}

      <div className={styles.stepperContainer}>
        {steps.map((step) => (
          <div
            key={step.index}
            className={`${step.index === 0 ? styles.step1 : styles.step2} ${
              step.isCompleted
                ? styles.completed
                : step.isActive
                  ? styles.active
                  : styles.inactive
            }`}
            data-testid={`step-circle-${step.index + 1}`}
          >
            {step.isCompleted ? (
              <span
                className={styles.checkmark}
                data-testid={`check-${step.index + 1}`}
              >
                ✓
              </span>
            ) : step.isActive ? (
              <div
                className={styles.barInner}
                style={{
                  width: `${step.percent}%`,
                  transition: step.percent === 0 ? "none" : undefined,
                }}
                data-testid={`step${step.index + 1}-inner`}
              />
            ) : (
              <div className={styles.inactiveDot} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
