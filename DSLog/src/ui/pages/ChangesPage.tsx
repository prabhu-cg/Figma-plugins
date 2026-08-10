import React, { useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { EmptyState } from "@ui/components/EmptyState";
import { ChangeRow } from "@ui/components/ChangeRow";
import type { Change } from "@shared/types/change";

type Filter = "all" | "added" | "modified" | "removed" | "breaking" | "components" | "tokens";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "added", label: "Added" },
  { id: "modified", label: "Changed" },
  { id: "removed", label: "Removed" },
  { id: "breaking", label: "Breaking" },
  { id: "tokens", label: "Tokens" },
  { id: "components", label: "Components" },
];

function matchesFilter(change: Change, filter: Filter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "added":
      return change.category === "added";
    case "modified":
      return change.category === "modified";
    case "removed":
      return change.category === "removed";
    case "breaking":
      return change.breaking || change.potentialBreaking;
    case "tokens":
      return change.entityType === "token";
    case "components":
      return change.entityType === "component";
    default:
      return true;
  }
}

export function ChangesPage() {
  const { project } = useProjectState();
  const [filter, setFilter] = useState<Filter>("all");

  const changeSet = useMemo(() => {
    if (!project?.currentBaselineId) return undefined;
    const sets = project.changeSets.filter((cs) => cs.baselineId === project.currentBaselineId);
    if (sets.length === 0) return undefined;
    return sets.reduce((latest, cs) => (cs.createdAt > latest.createdAt ? cs : latest));
  }, [project]);

  if (!project || !changeSet || changeSet.changes.length === 0) {
    return (
      <div className="dslog-page">
        <EmptyState
          title="No changes detected"
          description="Run a scan from the Overview tab after editing components or tokens to see what changed."
        />
      </div>
    );
  }

  const filtered = changeSet.changes.filter((c) => matchesFilter(c, filter));
  const componentCount = changeSet.changes.filter((c) => c.entityType === "component").length;
  const tokenCount = changeSet.changes.filter((c) => c.entityType === "token").length;

  const groups = new Map<string, Change[]>();
  for (const change of filtered) {
    const list = groups.get(change.entityName) ?? [];
    list.push(change);
    groups.set(change.entityName, list);
  }

  return (
    <div className="dslog-page">
      <div className="dslog-summary-row">
        <div className="dslog-stat-num">{changeSet.changes.length}</div>
        <div className="dslog-stat-name">changes detected</div>
      </div>
      <div className="dslog-stat-row">
        <div>
          <div className="dslog-stat-num">{componentCount}</div>
          <div className="dslog-stat-name">Components</div>
        </div>
        <div>
          <div className="dslog-stat-num">{tokenCount}</div>
          <div className="dslog-stat-name">Tokens</div>
        </div>
      </div>

      <div className="dslog-filters">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className={`dslog-filter ${filter === f.id ? "is-active" : ""}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {changeSet.scanSummary.skippedItems.length > 0 && (
        <details className="dslog-skipped">
          <summary>
            {changeSet.scanSummary.componentsScanned + changeSet.scanSummary.tokensScanned} scanned,{" "}
            {changeSet.scanSummary.skippedItems.length} skipped
          </summary>
          <ul>
            {changeSet.scanSummary.skippedItems.map((item) => (
              <li key={item.id}>
                {item.name}: {item.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="dslog-change-groups">
        {Array.from(groups.entries()).map(([entityName, changes]) => (
          <div key={entityName} className="dslog-change-group">
            <div className="dslog-change-group__title">{entityName}</div>
            {changes.map((change) => (
              <ChangeRow key={change.id} change={change} changeSetId={changeSet.id} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
