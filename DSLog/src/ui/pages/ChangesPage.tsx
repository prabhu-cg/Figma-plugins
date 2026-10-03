import { useMemo } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeDetail } from "@ui/components/ChangeDetail";
import { RenameSuggestionBanner } from "@ui/components/RenameSuggestionBanner";
import { TrackIcon } from "@ui/components/Icons";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { ChangesFilterBar } from "./changes/ChangesFilterBar";
import { ChangesList } from "./changes/ChangesList";
import { BulkBar, UndoBar } from "./changes/ReviewBars";
import { useChangesView } from "./changes/useChangesView";

export function ChangesPage({
  focusChangeId,
  onFocusConsumed,
}: {
  focusChangeId?: string;
  onFocusConsumed?: () => void;
} = {}) {
  const { project, send, scanning } = useProjectState();

  const changeSet = useMemo(() => {
    if (!project?.currentBaselineId) return undefined;
    return getLatestChangeSetForBaseline(project, project.currentBaselineId);
  }, [project]);

  const view = useChangesView(changeSet, focusChangeId, onFocusConsumed);

  if (!project) return null;

  if (!changeSet || changeSet.changes.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No changes detected</div>
        <div className="state-body">
          Edit components or tokens in Figma, then scan to see what changed since your baseline.
        </div>
        <button className="btn btn-primary" disabled={scanning} onClick={() => send({ type: "scan" })}>
          {scanning ? "Scanning…" : "Scan for changes"}
        </button>
      </div>
    );
  }

  const componentCount = changeSet.changes.filter((c) => c.entityType === "component").length;
  const tokenCount = changeSet.changes.filter((c) => c.entityType === "token").length;
  const unreviewedCount = changeSet.changes.filter((c) => c.reviewState === "unreviewed").length;
  const reviewedCount = changeSet.changes.length - unreviewedCount;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, paddingBottom: 12, marginBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Changes</div>
            <div className="view-subtitle">
              {changeSet.changes.length} changes · {componentCount} components · {tokenCount} tokens ·{" "}
              {unreviewedCount} unreviewed · {reviewedCount} reviewed
            </div>
          </div>
        </div>

        <ChangesFilterBar view={view} />

        {changeSet.scanSummary.skippedItems.length > 0 && (
          <details style={{ marginTop: 12, fontSize: 11.5 }} className="text-secondary">
            <summary>
              {changeSet.scanSummary.componentsScanned + changeSet.scanSummary.tokensScanned} scanned,{" "}
              {changeSet.scanSummary.skippedItems.length} skipped
            </summary>
            <ul style={{ marginTop: 6, paddingLeft: 16 }}>
              {changeSet.scanSummary.skippedItems.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}>
        <RenameSuggestionBanner changeSetId={changeSet.id} changes={changeSet.changes} />

        <div className="sr-only" role="status" aria-live="polite">
          {view.lastAction?.message ?? ""}
        </div>

        <BulkBar view={view} />

        {view.filtered.length === 0 ? (
          <div className="card state-card">
            <div className="text-secondary">No changes match these filters.</div>
            <button className="btn btn-secondary btn-sm" onClick={view.clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="split">
            <ChangesList view={view} unreviewedCount={unreviewedCount} />
            <ChangeDetail change={view.selected} changeSetId={changeSet.id} onReview={view.reviewSelected} />
          </div>
        )}

        <UndoBar view={view} />
      </div>
    </div>
  );
}
