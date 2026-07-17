import type { ScanProgress, ScanStatus } from "../state/useScan";
import { AlertIcon, AuditIcon, CheckCircleIcon } from "./Icons";

interface ScanGateProps {
  status: ScanStatus;
  progress: ScanProgress;
  errorMessage: string | null;
  onStart: () => void;
  onCancel: () => void;
}

export function ScanGate({ status, progress, errorMessage, onStart, onCancel }: ScanGateProps) {
  if (status === "scanning") {
    const pct = progress.total > 0 ? Math.min(100, Math.round((progress.processed / progress.total) * 100)) : 0;
    return (
      <div className="state-screen">
        <div className="state-icon">
          <AuditIcon className="icon" style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">Auditing your design system…</div>
        <div className="state-body">{progress.phase || "Scanning components, variants, and variables"}</div>
        <div style={{ width: 320 }}>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {progress.total > 1 ? `${progress.processed} / ${progress.total}` : "Working…"}
            </span>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {pct}%
            </span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={onCancel}>
          Cancel scan
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="state-screen">
        <div className="state-icon" style={{ background: "var(--color-critical-soft)", color: "var(--color-critical)" }}>
          <AlertIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">Scan failed</div>
        <div className="state-body">{errorMessage ?? "Something went wrong while auditing this file."}</div>
        <button className="btn btn-primary" onClick={onStart}>
          Try again
        </button>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <AuditIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">Scan cancelled</div>
        <div className="state-body">No changes were made. Start a new audit whenever you're ready.</div>
        <button className="btn btn-primary" onClick={onStart}>
          Start audit
        </button>
      </div>
    );
  }

  return (
    <div className="state-screen">
      <div className="state-icon" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
        <CheckCircleIcon style={{ width: 24, height: 24 }} />
      </div>
      <div className="state-title">DesignLens is ready</div>
      <div className="state-body">
        Scan this file's components, variants, variables, and styles to generate a full design system health
        report — contrast, tokens, documentation, governance, and more.
      </div>
      <button className="btn btn-primary" onClick={onStart}>
        Start audit
      </button>
    </div>
  );
}
