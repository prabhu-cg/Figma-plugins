import React from "react";

export function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="dslog-progress">
      <div className="dslog-progress__label">
        <span>{label}</span>
        <span>
          {done} / {total}
        </span>
      </div>
      <div className="dslog-progress__track">
        <div className="dslog-progress__fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
