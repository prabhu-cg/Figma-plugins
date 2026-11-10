interface ProgressBarProps {
  stage: string;
  percent: number;
  /** Items finished and in total, shown next to the percentage when known. */
  done?: number;
  total?: number;
  /** What is being worked on, such as the page being searched. */
  detail?: string;
}

const STAGE_LABELS: Record<string, string> = {
  variables: 'Reading variables',
  'text-styles': 'Reading text styles',
  'color-styles': 'Reading color styles',
  'effect-styles': 'Reading effect styles',
  'grid-styles': 'Reading grid styles',
  pages: 'Searching pages',
  components: 'Reading components',
  structure: 'Reading component layers',
  assemble: 'Building components.json',
};

export function ProgressBar({ stage, percent, done, total, detail }: ProgressBarProps) {
  return (
    <div
      className="dmd-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Reading the design system"
    >
      <div className="dmd-progress-label">
        {STAGE_LABELS[stage] ?? stage}… {percent}%
        {done !== undefined && total !== undefined && total > 0 ? ` · ${done} of ${total}` : ''}
        {detail ? ` · ${detail}` : ''}
      </div>
      <div className="dmd-progress-track">
        <div className="dmd-progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}
