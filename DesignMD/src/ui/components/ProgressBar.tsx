interface ProgressBarProps {
  stage: string;
  percent: number;
}

const STAGE_LABELS: Record<string, string> = {
  variables: 'Reading variables',
  'text-styles': 'Reading text styles',
  'color-styles': 'Reading color styles',
  'effect-styles': 'Reading effect styles',
  'grid-styles': 'Reading grid styles',
  components: 'Reading components',
};

export function ProgressBar({ stage, percent }: ProgressBarProps) {
  return (
    <div
      className="dmd-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Scanning design system"
    >
      <div className="dmd-progress-label">
        {STAGE_LABELS[stage] ?? stage}… {percent}%
      </div>
      <div className="dmd-progress-track">
        <div className="dmd-progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}
