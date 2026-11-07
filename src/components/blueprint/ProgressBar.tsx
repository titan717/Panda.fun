interface ProgressBarProps {
  value: number;
  className?: string;
}

export function ProgressBar({ value, className = '' }: ProgressBarProps) {
  const percent = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      className={`bp-progress ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className="bp-progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}

export default ProgressBar;
