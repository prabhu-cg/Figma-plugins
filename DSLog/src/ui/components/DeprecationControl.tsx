import React, { useEffect, useState } from "react";
import type { EntityKind, TrackedEntity } from "@shared/types/entity";
import { useProjectState } from "@ui/state/ProjectContext";

/**
 * Mark/unmark-deprecated control for a single entity (component, variant,
 * property, or token — spec §12). Shared between the Changes detail panel
 * and the component/token History views, since deprecation is a property
 * of the entity, not of any one Change.
 */
export function DeprecationControl({
  entityId,
  kind,
  parentId,
  displayName,
  trackedEntity,
}: {
  entityId: string;
  kind: EntityKind;
  parentId?: string;
  displayName: string;
  trackedEntity: TrackedEntity | undefined;
}) {
  const { send } = useProjectState();
  const [expanded, setExpanded] = useState(false);
  const [replacement, setReplacement] = useState(trackedEntity?.replacement ?? "");
  const [migrationNote, setMigrationNote] = useState(trackedEntity?.migrationNote ?? "");

  useEffect(() => {
    setReplacement(trackedEntity?.replacement ?? "");
    setMigrationNote(trackedEntity?.migrationNote ?? "");
  }, [entityId, trackedEntity?.replacement, trackedEntity?.migrationNote]);

  if (trackedEntity?.deprecated) {
    return (
      <div>
        <div className="card-title" style={{ marginBottom: 6 }}>
          Deprecation
        </div>
        <div className="card" style={{ background: "var(--color-surface-alt)" }}>
          <div className="flex items-center justify-between wrap gap-2">
            <span className="badge badge-neutral">Deprecated</span>
            <button className="btn btn-secondary btn-sm" onClick={() => send({ type: "unmark-deprecated", entityId })}>
              Remove deprecation
            </button>
          </div>
          {trackedEntity.replacement && (
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
              <span style={{ fontWeight: 600 }}>Replacement:</span> {trackedEntity.replacement}
            </div>
          )}
          {trackedEntity.migrationNote && (
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 4 }}>
              <span style={{ fontWeight: 600 }}>Migration:</span> {trackedEntity.migrationNote}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!expanded) {
    return (
      <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(true)}>
        Mark deprecated
      </button>
    );
  }

  return (
    <div>
      <div className="card-title" style={{ marginBottom: 6 }}>
        Deprecation
      </div>
      <div className="card flex flex-col gap-2">
        <label className="field">
          <span className="field-label">Replacement</span>
          <input
            className="input"
            placeholder="e.g. Button / XL"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Migration note</span>
          <textarea
            className="textarea"
            rows={2}
            placeholder="Describe how consumers should migrate"
            value={migrationNote}
            onChange={(e) => setMigrationNote(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              send({
                type: "mark-deprecated",
                entityId,
                kind,
                parentId,
                displayName,
                replacement: replacement.trim() || undefined,
                migrationNote: migrationNote.trim() || undefined,
              });
              setExpanded(false);
            }}
          >
            Confirm
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setExpanded(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
