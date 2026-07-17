import type { Issue, IssueStatus } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { SeverityBadge } from "../Shared";

interface IssueDetailProps {
  issue: Issue | null;
  onSelectNode: (id: string) => void;
  onSetStatus: (issue: Issue, status: IssueStatus) => void;
  /** Pixels reserved above this panel for a sticky header, so its own sticky position doesn't sit underneath it. */
  stickyTop?: number;
}

export function IssueDetail({ issue, onSelectNode, onSetStatus, stickyTop = 0 }: IssueDetailProps) {
  if (!issue) {
    return (
      <div className="card state-card" style={{ position: "sticky", top: stickyTop }}>
        <div className="text-secondary">Select an issue to see the full recommendation.</div>
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
        top: stickyTop,
        maxHeight: `calc(100vh - ${stickyTop + 40}px)`,
        display: "flex",
        flexDirection: "column"
      }}
    >
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
            </div>
            {issue.status !== "open" && (
              <span className="badge badge-success">{issue.status === "resolved" ? "Resolved" : "Ignored"}</span>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{issue.title}</div>
            <div className="text-secondary" style={{ marginTop: 4, fontSize: 12.5 }}>
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
                  <div style={{ fontWeight: 700, fontSize: 12.5 }}>{issue.node.componentName ?? issue.node.name}</div>
                  <div className="text-tertiary" style={{ fontSize: 11 }}>
                    {issue.node.pageName}
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => onSelectNode(issue.node!.id)}>
                  Go to layer
                </button>
              </div>
            </div>
          )}
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
      <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="card-title">{label}</div>
      <div style={{ fontWeight: 700, textTransform: "capitalize", fontSize: 12.5 }}>{value}</div>
    </div>
  );
}
