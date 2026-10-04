import type { Issue, IssueStatus } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { SeverityBadge } from "../Shared";

interface IssueDetailProps {
  issue: Issue | null;
  onSelectNode: (id: string) => void;
  onSetStatus: (issue: Issue, status: IssueStatus) => void;
  /** Narrow windows show the panel as a bottom sheet, which needs a way to dismiss it. */
  onClose: () => void;
}

export function IssueDetail({ issue, onSelectNode, onSetStatus, onClose }: IssueDetailProps) {
  if (!issue) {
    return (
      <div className="card state-card detail-panel detail-empty">
        <div className="text-secondary">Select an issue to see the full recommendation.</div>
      </div>
    );
  }

  return (
    <div className="card detail-panel" role="region" aria-label="Issue details">
      {/*
        Three layers on purpose: this middle one owns overflow-y:auto with zero padding, so the
        scrollbar renders flush at the card's own edge instead of eating into the content's
        padding — the inner layer below always keeps identical padding on all four sides,
        whether or not the scrollbar is actually showing.
      */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "var(--space-3)"
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={issue.severity} />
              <span className="badge badge-neutral">{CATEGORY_LABELS[issue.category]}</span>
              {issue.status !== "open" && (
                <span className="badge badge-success">{issue.status === "resolved" ? "Resolved" : "Ignored"}</span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm detail-close" onClick={onClose}>
              Close
            </button>
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "var(--text-md)" }}>{issue.title}</div>
            <div className="text-secondary" style={{ marginTop: 4, fontSize: "var(--text-base)" }}>
              {issue.description}
            </div>
          </div>
          <Field label="Why it matters" value={issue.whyItMatters} />
          <Field label="Suggested fix" value={issue.recommendation} />
          <div className="flex gap-3">
            <MiniStat label="Impact" value={issue.estimatedImpact} />
            <MiniStat label="Effort" value={issue.estimatedEffort} />
          </div>
          {issue.reference && <Field label="Reference" value={issue.reference} />}
          {issue.node && (
            <div>
              <div className="card-title" style={{ marginBottom: 6 }}>
                Affected layer
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontWeight: 700, fontSize: "var(--text-base)" }}>{issue.node.componentName ?? issue.node.name}</div>
                  <div className="text-tertiary" style={{ fontSize: "var(--text-xs)" }}>
                    {issue.node.pageName}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => onSelectNode(issue.node!.id)}>
                  Go to layer
                </button>
              </div>
            </div>
          )}
          <div className="visually-hidden" role="status" aria-live="polite">
            {issue.status === "open" ? "" : `Issue marked ${issue.status}`}
          </div>
          <div className="flex gap-2" style={{ borderTop: "1px solid var(--color-border)", paddingTop: 14 }}>
            {issue.status !== "resolved" && (
              <button className="btn btn-primary btn-sm" onClick={() => onSetStatus(issue, "resolved")}>
                Mark resolved
              </button>
            )}
            {issue.status !== "ignored" && (
              <button className="btn btn-secondary btn-sm" onClick={() => onSetStatus(issue, "ignored")}>
                Ignore
              </button>
            )}
            {issue.status !== "open" && (
              <button className="btn btn-ghost btn-sm" onClick={() => onSetStatus(issue, "open")}>
                Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="card-title" style={{ marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: "var(--text-base)", lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="card-title">{label}</div>
      <div style={{ fontWeight: 700, textTransform: "capitalize", fontSize: "var(--text-base)" }}>{value}</div>
    </div>
  );
}
