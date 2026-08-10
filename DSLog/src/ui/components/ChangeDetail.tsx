import React, { useEffect, useState } from "react";
import type { Change } from "@shared/types/change";
import { CategoryBadge, BreakingBadge } from "./Shared";
import { useProjectState } from "@ui/state/ProjectContext";

function formatValue(value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="card-title" style={{ marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

export function ChangeDetail({ change, changeSetId }: { change: Change | null; changeSetId: string }) {
  const { send } = useProjectState();
  const [reviewNote, setReviewNote] = useState(change?.reviewNote ?? "");
  const [migrationNote, setMigrationNote] = useState(change?.migrationNote ?? "");

  useEffect(() => {
    setReviewNote(change?.reviewNote ?? "");
    setMigrationNote(change?.migrationNote ?? "");
  }, [change?.id]);

  if (!change) {
    return (
      <div className="card state-card" style={{ position: "sticky", top: 0 }}>
        <div className="text-secondary">Select a change to see the full detail.</div>
      </div>
    );
  }

  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        position: "sticky",
        top: 0,
        maxHeight: "calc(100vh - 80px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: "var(--space-3)" }}>
          <div className="flex items-center gap-2 wrap">
            <CategoryBadge category={change.category} />
            <BreakingBadge breaking={change.breaking} potential={change.potentialBreaking} />
            {change.reviewed && <span className="badge badge-neutral">Reviewed</span>}
          </div>

          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{change.entityName}</div>
            <div className="text-secondary" style={{ marginTop: 4, fontSize: 12.5 }}>
              {change.summary}
            </div>
          </div>

          {change.modeDetails && change.modeDetails.length > 0 ? (
            <Field label="Modes">
              <div className="flex flex-col">
                {change.modeDetails.map((mode) => (
                  <div key={mode.modeName} className="mode-row">
                    <span style={{ fontWeight: 700 }}>{mode.modeName}</span>
                    {mode.changed ? (
                      <span className="mode-row-diff">
                        <span>{formatValue(mode.before)}</span>
                        <span aria-hidden>→</span>
                        <span>{formatValue(mode.after)}</span>
                      </span>
                    ) : (
                      <span className="text-tertiary">No change</span>
                    )}
                  </div>
                ))}
              </div>
            </Field>
          ) : (
            <div className="flex gap-3">
              <div style={{ flex: 1 }}>
                <Field label="Before">
                  <div className="code-block">{formatValue(change.before)}</div>
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="After">
                  <div className="code-block">{formatValue(change.after)}</div>
                </Field>
              </div>
            </div>
          )}

          <Field label="Reason">
            <textarea
              className="textarea"
              rows={2}
              value={reviewNote}
              placeholder="Add release note"
              onChange={(e) => setReviewNote(e.target.value)}
              onBlur={() => send({ type: "update-change", changeSetId, changeId: change.id, reviewNote })}
            />
          </Field>

          <Field label="Migration">
            <textarea
              className="textarea"
              rows={2}
              value={migrationNote}
              placeholder="Describe migration"
              onChange={(e) => setMigrationNote(e.target.value)}
              onBlur={() => send({ type: "update-change", changeSetId, changeId: change.id, migrationNote })}
            />
          </Field>

          <div className="flex gap-2" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            {change.entityType === "component" && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => send({ type: "focus-node", nodeId: change.entityId })}
              >
                Select in canvas
              </button>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={() => send({ type: "update-change", changeSetId, changeId: change.id, reviewed: !change.reviewed })}
            >
              {change.reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
