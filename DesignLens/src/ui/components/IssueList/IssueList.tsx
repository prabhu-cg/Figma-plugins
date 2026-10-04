import type { Issue } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { SeverityBadge } from "../Shared";
import { CheckCircleIcon } from "../Icons";

interface IssueListProps {
  issues: Issue[];
  /** Issues in the whole scan, to tell "nothing found" apart from "filters hide everything". */
  totalIssues: number;
  selectedId: string | null;
  checked: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggleChecked: (id: string) => void;
  onClearFilters: () => void;
}

export function IssueList({ issues, totalIssues, selectedId, checked, onSelect, onToggleChecked, onClearFilters }: IssueListProps) {
  if (totalIssues === 0) {
    return (
      <div className="card state-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        <CheckCircleIcon style={{ width: 28, height: 28, color: "var(--color-success-text)" }} />
        <div style={{ fontWeight: 800 }}>No issues found</div>
        <div className="text-secondary">Every audit rule passed for this file. Rescan after your next change to keep it that way.</div>
      </div>
    );
  }

  if (issues.length === 0) {
    return (
      <div className="card state-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <div className="text-secondary">No issues match these filters.</div>
        <button className="btn btn-secondary btn-sm" onClick={onClearFilters}>
          Clear filters
        </button>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <div key={issue.id} className="issue-row" data-issue-id={issue.id}>
          <input
            type="checkbox"
            className="issue-check"
            checked={checked.has(issue.id)}
            onChange={() => onToggleChecked(issue.id)}
            aria-label={`Select: ${issue.title}`}
          />
          <button
            onClick={() => onSelect(issue.id)}
            aria-pressed={selectedId === issue.id}
            className={`card issue-card${issue.status === "open" ? "" : " is-done"}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={issue.severity} />
                {issue.status !== "open" && (
                  <span className="badge badge-neutral">{issue.status === "resolved" ? "Resolved" : "Ignored"}</span>
                )}
              </div>
              <span className="issue-meta">{CATEGORY_LABELS[issue.category]}</span>
            </div>
            <div className="issue-title">{issue.title}</div>
            <div className="text-secondary" style={{ fontSize: 12 }}>
              {issue.description}
            </div>
            {issue.node && <div className="issue-meta">{issue.node.componentName ?? issue.node.name}</div>}
          </button>
        </div>
      ))}
    </div>
  );
}
