import React from "react";
import type { Change } from "@shared/types/change";
import { useProjectState } from "@ui/state/ProjectContext";

/**
 * Surfaces unresolved rename suggestions from `detectPossibleRenames`
 * (spec §13). Never auto-merges — always requires an explicit human
 * confirm/dismiss, shown above the change list it applies to.
 */
export function RenameSuggestionBanner({ changeSetId, changes }: { changeSetId: string; changes: Change[] }) {
  const { send } = useProjectState();

  const suggestions = changes
    .filter((c) => c.possibleRenameOf && !c.renameResolution)
    .map((addedChange) => ({
      addedChange,
      removedChange: changes.find((c) => c.id === addedChange.possibleRenameOf),
    }))
    .filter((s): s is { addedChange: Change; removedChange: Change } => Boolean(s.removedChange));

  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-col gap-2" style={{ marginBottom: 12 }}>
      {suggestions.map(({ addedChange, removedChange }) => (
        <div key={addedChange.id} className="card" style={{ borderColor: "var(--color-warning, var(--color-border))" }}>
          <div className="flex items-center justify-between wrap gap-2">
            <div>
              <div style={{ fontWeight: 700, fontSize: 12.5 }}>Possible rename detected</div>
              <div className="text-secondary" style={{ fontSize: 12, marginTop: 4 }}>
                <span style={{ fontWeight: 600 }}>Before:</span> {removedChange.entityName}
                <span aria-hidden style={{ margin: "0 6px" }}>
                  →
                </span>
                <span style={{ fontWeight: 600 }}>After:</span> {addedChange.entityName}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={() =>
                  send({
                    type: "confirm-rename",
                    changeSetId,
                    addedChangeId: addedChange.id,
                    removedChangeId: removedChange.id,
                  })
                }
              >
                Confirm rename
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  send({
                    type: "dismiss-rename",
                    changeSetId,
                    addedChangeId: addedChange.id,
                    removedChangeId: removedChange.id,
                  })
                }
              >
                Treat as remove + add
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
