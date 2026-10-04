import type { ScanProgress, ScanStatus } from "../state/useScan";
import { AlertIcon, AuditIcon } from "./Icons";
import { ProgressBar } from "./Shared";

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
        <h1 className="state-title">Auditing your design system…</h1>
        <div className="visually-hidden" role="status" aria-live="polite">
          Audit in progress
        </div>
        <div className="state-body">{progress.phase || "Scanning components, variants, and variables"}</div>
        <div style={{ width: 320 }}>
          <ProgressBar value={pct} label="Audit progress" />
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <span className="text-tertiary" style={{ fontSize: "var(--text-xs)" }}>
              {progress.total > 1 ? `${progress.processed} / ${progress.total}` : "Working…"}
            </span>
            <span className="text-tertiary" style={{ fontSize: "var(--text-xs)" }}>
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
        <div className="state-icon" style={{ background: "var(--color-critical-soft)", color: "var(--color-critical-text)" }}>
          <AlertIcon style={{ width: 24, height: 24 }} />
        </div>
        <h1 className="state-title">Scan failed</h1>
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
        <h1 className="state-title">Scan cancelled</h1>
        <div className="state-body">No changes were made. Start a new audit whenever you're ready.</div>
        <button className="btn btn-primary" onClick={onStart}>
          Start audit
        </button>
      </div>
    );
  }

  return (
    <div className="state-screen">
      <div className="state-icon">
        <AuditIcon style={{ width: 24, height: 24 }} />
      </div>
      <h1 className="state-title">Audit this file</h1>
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
