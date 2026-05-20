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
    <div className="progress-container">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }}></div>
      </div>
      <div className="status-text">{message}</div>
    </div>
  );
}
