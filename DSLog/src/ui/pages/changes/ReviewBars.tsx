import { REVIEW_STATES, REVIEW_STATE_LABEL } from "@shared/utils/changeReview";
import type { ReviewState } from "@shared/types/entity";
import type { ChangesView } from "./useChangesView";

/** The bulk-apply bar, shown while rows are checked. */
export function BulkBar({ view }: { view: ChangesView }) {
  if (view.checkedIds.size === 0) return null;
  return (
    <div className="card flex items-center justify-between wrap gap-2" style={{ marginBottom: 12 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{view.checkedIds.size} selected</span>
      <div className="flex items-center gap-2">
        <div className="select-wrapper">
          <select
            className="select"
            aria-label="Mark selected as"
            value={view.bulkTarget}
            onChange={(e) => view.setBulkTarget(e.target.value as ReviewState)}
          >
            {REVIEW_STATES.map((state) => (
              <option key={state} value={state}>
                {REVIEW_STATE_LABEL[state]}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={view.applyBulk}>
          Apply
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => view.setCheckedIds(new Set())}>
          Clear
        </button>
      </div>
    </div>
  );
}

/** What just happened and a way back. Pinned to the bottom of the scroll area so showing it never moves the list. */
export function UndoBar({ view }: { view: ChangesView }) {
  if (!view.lastAction) return null;
  return (
    <div
      className="card flex items-center justify-between gap-2"
      style={{ position: "sticky", bottom: 0, marginTop: 12, boxShadow: "var(--shadow-md)", zIndex: 5 }}
    >
      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{view.lastAction.message}</span>
      <button className="btn btn-secondary btn-sm" onClick={view.undo}>
        Undo{" "}
        <span className="kbd" aria-hidden>
          Z
        </span>
      </button>
    </div>
  );
}
