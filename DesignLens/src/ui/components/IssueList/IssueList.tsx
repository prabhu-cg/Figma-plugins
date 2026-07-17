import type { Issue } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import { SeverityBadge } from "../Shared";

interface IssueListProps {
  issues: Issue[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function IssueList({ issues, selectedId, onSelect }: IssueListProps) {
  if (issues.length === 0) {
    return (
      <div className="card state-card">
        <div className="text-secondary">No issues match these filters.</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {issues.map((issue) => (
        <button
          key={issue.id}
          onClick={() => onSelect(issue.id)}
          className="card"
          style={{
            textAlign: "left",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            opacity: issue.status === "open" ? 1 : 0.55,
            border: `1px solid ${selectedId === issue.id ? "var(--color-primary)" : "var(--color-border)"}`
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={issue.severity} />
              {issue.status !== "open" && (
                <span className="badge badge-neutral">{issue.status === "resolved" ? "Resolved" : "Ignored"}</span>
              )}
            </div>
            <span className="text-tertiary" style={{ fontSize: 11 }}>
              {CATEGORY_LABELS[issue.category]}
            </span>
          </div>
          <div style={{ fontWeight: 700, fontSize: 12.5 }}>{issue.title}</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>
            {issue.description}
          </div>
          {issue.node && (
            <div className="text-tertiary" style={{ fontSize: 11 }}>
              {issue.node.componentName ?? issue.node.name}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
