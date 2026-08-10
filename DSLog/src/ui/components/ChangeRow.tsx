import React, { useState } from "react";
import type { Change } from "@shared/types/change";
import { CategoryBadge, BreakingBadge } from "./Badge";
import { useProjectState } from "@ui/state/ProjectContext";

function formatValue(value: unknown): string {
  if (value === undefined) return "—";
  if (value === null) return "—";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function ChangeRow({ change, changeSetId }: { change: Change; changeSetId: string }) {
  const { send } = useProjectState();
  const [expanded, setExpanded] = useState(false);
  const [reviewNote, setReviewNote] = useState(change.reviewNote ?? "");
  const [migrationNote, setMigrationNote] = useState(change.migrationNote ?? "");

  return (
    <div className={`dslog-change ${change.reviewed ? "is-reviewed" : ""}`}>
      <button className="dslog-change__summary" onClick={() => setExpanded((v) => !v)}>
        <CategoryBadge category={change.category} />
        <BreakingBadge breaking={change.breaking} potential={change.potentialBreaking} />
        <span className="dslog-change__text">{change.summary}</span>
        {change.reviewed && <span className="dslog-badge dslog-badge--reviewed">Reviewed</span>}
      </button>

      {expanded && (
        <div className="dslog-change__detail">
          {change.modeDetails && change.modeDetails.length > 0 ? (
            <div className="dslog-modes">
              {change.modeDetails.map((mode) => (
                <div key={mode.modeName} className="dslog-mode-row">
                  <div className="dslog-mode-row__name">{mode.modeName}</div>
                  {mode.changed ? (
                    <div className="dslog-mode-row__diff">
                      <span>{formatValue(mode.before)}</span>
                      <span aria-hidden>→</span>
                      <span>{formatValue(mode.after)}</span>
                    </div>
                  ) : (
                    <div className="dslog-mode-row__diff dslog-mode-row__diff--nochange">No change</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="dslog-before-after">
              <div>
                <div className="dslog-label">Before</div>
                <div className="dslog-code">{formatValue(change.before)}</div>
              </div>
              <div>
                <div className="dslog-label">After</div>
                <div className="dslog-code">{formatValue(change.after)}</div>
              </div>
            </div>
          )}

          <label className="dslog-field">
            <span>Reason</span>
            <textarea
              rows={2}
              value={reviewNote}
              placeholder="Add release note"
              onChange={(e) => setReviewNote(e.target.value)}
              onBlur={() => send({ type: "update-change", changeSetId, changeId: change.id, reviewNote })}
            />
          </label>

          <label className="dslog-field">
            <span>Migration</span>
            <textarea
              rows={2}
              value={migrationNote}
              placeholder="Describe migration"
              onChange={(e) => setMigrationNote(e.target.value)}
              onBlur={() => send({ type: "update-change", changeSetId, changeId: change.id, migrationNote })}
            />
          </label>

          <div className="dslog-actions">
            {change.entityType === "component" && (
              <button
                className="dslog-link"
                onClick={() => send({ type: "focus-node", nodeId: change.entityId })}
              >
                Select in canvas
              </button>
            )}
            <button
              className="dslog-link"
              onClick={() => send({ type: "update-change", changeSetId, changeId: change.id, reviewed: !change.reviewed })}
            >
              {change.reviewed ? "Mark as unreviewed" : "Mark as reviewed"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
