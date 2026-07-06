export interface ProgressBarProps {
  percent: number;
  label?: string;
}

export function ProgressBar({ percent, label }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="w-full">
      {label && <div className="mb-1 flex justify-between text-xxs text-gray-500">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-subtle">
        <div
          className="h-full rounded-full bg-brand-500 transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
