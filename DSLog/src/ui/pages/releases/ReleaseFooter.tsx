import { useProjectState } from "@ui/state/ProjectContext";
import type { ReleaseDraft } from "./useReleaseDraft";

/** The create button, the reason it may be unavailable, and the confirm step. */
export function ReleaseFooter({ draft }: { draft: ReleaseDraft }) {
  const { scanning } = useProjectState();
  const { blockers, canCreate, confirming, setConfirming, version, includedCount } = draft;

  return (
    <div className="card" style={{ marginTop: "var(--space-3)" }}>
      {confirming ? (
        <div className="confirm-panel" role="group" aria-label="Confirm release">
          <div style={{ fontWeight: 700, fontSize: 13 }}>
            Create v{version.trim()} from {draft.changesSinceRelease.length} change
            {draft.changesSinceRelease.length === 1 ? "" : "s"}?
          </div>
          {draft.unreviewedInRelease > 0 && (
            <div style={{ fontSize: 12, color: "var(--color-warning-text)" }}>
              {draft.unreviewedInRelease} of these {draft.unreviewedInRelease === 1 ? "is" : "are"} still unreviewed.
            </div>
          )}
          <div className="text-secondary" style={{ fontSize: 12 }}>
            This release becomes the new baseline (currently v{draft.baseline?.version}). Your next scan will compare
            against it, and a release can't be undone from here.
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary" disabled={scanning} onClick={draft.createRelease} autoFocus>
              {scanning ? "Working…" : `Create v${version.trim()}`}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span
            id="release-status"
            className={blockers.length > 0 ? undefined : "text-secondary"}
            style={{ fontSize: 12.5, color: blockers.length > 0 ? "var(--color-critical-text)" : undefined }}
          >
            {blockers.length > 0
              ? `Can't create yet: ${blockers.join("; ")}`
              : `${includedCount} of 4 sections included`}
          </span>
          <button
            className="btn btn-primary"
            disabled={!canCreate || scanning}
            aria-describedby="release-status"
            onClick={() => setConfirming(true)}
          >
            Create release
          </button>
        </div>
      )}
    </div>
  );
}
