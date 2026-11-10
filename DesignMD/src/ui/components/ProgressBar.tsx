import { useRef } from 'react';

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

/** "about 3 min left" from how fast this stage has gone so far; empty until the rate is trustworthy. */
export function formatRemaining(elapsedMs: number, progressed: number, left: number): string {
  if (elapsedMs < 5000 || progressed <= 0 || left <= 0) return '';
  const seconds = (elapsedMs / 1000) * (left / progressed);
  if (seconds < 10) return '';
  if (seconds < 90) return `about ${Math.round(seconds / 5) * 5} s left`;
  return `about ${Math.round(seconds / 60)} min left`;
}

export function ProgressBar({ stage, percent, done, total, detail }: ProgressBarProps) {
  // When this stage began, and how far along it already was, so the estimate uses only its own pace.
  const began = useRef({ stage, at: Date.now(), percent });
  if (began.current.stage !== stage) began.current = { stage, at: Date.now(), percent };
  // From the percentage, which the plugin weights by the work each item takes, not from item counts.
  const remaining = formatRemaining(
    Date.now() - began.current.at,
    percent - began.current.percent,
    100 - percent,
  );

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
        {remaining ? ` · ${remaining}` : ''}
      </div>
      <div className="dmd-progress-track">
        <div className="dmd-progress-fill" style={{ transform: `scaleX(${percent / 100})` }} />
      </div>
    </div>
  );
}
