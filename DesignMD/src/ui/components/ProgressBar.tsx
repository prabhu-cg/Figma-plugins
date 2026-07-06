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
    <div className="dmd-progress">
      <div className="dmd-progress-label">
        {STAGE_LABELS[stage] ?? stage}… {percent}%
      </div>
      <div className="dmd-progress-track">
        <div className="dmd-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
