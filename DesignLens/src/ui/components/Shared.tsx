import type { Severity } from "@shared/types";
import { SCORE_BANDS } from "@shared/scoring";

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-label">{sub}</div>}
    </div>
  );
}

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  suggestion: "Suggestion"
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <span className={`badge badge-${severity}`}>{SEVERITY_LABEL[severity]}</span>;
}

export function TrendBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0) {
    return (
      <span className="badge badge-neutral" title="No change since last scan">
        ± 0
      </span>
    );
  }
  const positive = delta > 0;
  return (
    <span className={`badge ${positive ? "badge-success" : "badge-critical"}`} title="Change since last scan">
      {positive ? "▲" : "▼"} {Math.abs(delta)}
    </span>
  );
}

export function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between" style={{ fontSize: "var(--text-sm)" }}>
      <span className="flex items-center gap-2">
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: "inline-block" }} />
        {label}
      </span>
      <span style={{ fontWeight: 700 }}>{value.toLocaleString()}</span>
    </div>
  );
}

/**
 * Fill and text colors for a 0-100 score. Fills use the vivid step; text uses the AA-contrast step.
 * The middle band is the warning amber, not the brand orange: orange means "brand/action" in this
 * UI, and a score that needs work shouldn't look like a button.
 */
export function scoreColors(score: number): { fill: string; text: string } {
  if (score >= SCORE_BANDS.healthy) return { fill: "var(--color-success)", text: "var(--color-success-text)" };
  if (score >= SCORE_BANDS.needsWork) return { fill: "var(--color-warning)", text: "var(--color-warning-text)" };
  return { fill: "var(--color-critical)", text: "var(--color-critical-text)" };
}

interface ProgressBarProps {
  /** 0-100 */
  value: number;
  /** Accessible name. Omit only when the value is shown as adjacent text (decorative bar). */
  label?: string;
  color?: string;
  width?: number | string;
}

export function ProgressBar({ value, label, color, width }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const a11y = label
    ? { role: "progressbar", "aria-label": label, "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": Math.round(pct) }
    : { "aria-hidden": true };
  return (
    <div className="progress-track" style={width !== undefined ? { width } : undefined} {...a11y}>
      <div className="progress-fill" style={{ transform: `scaleX(${pct / 100})`, ...(color ? { background: color } : null) }} />
    </div>
  );
}

export function ScoreBar({
  label,
  score,
  right,
  delta
}: {
  label: string;
  score: number;
  right?: string;
  delta?: number | null;
}) {
  const { fill, text } = scoreColors(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div className="flex items-center justify-between">
        <span style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>{label}</span>
        <span className="flex items-center gap-2">
          {delta !== undefined && <TrendBadge delta={delta} />}
          <span style={{ fontWeight: 800, fontSize: "var(--text-base)", color: text }}>{right ?? `${score}`}</span>
        </span>
      </div>
      <ProgressBar value={score} color={fill} />
    </div>
  );
}
