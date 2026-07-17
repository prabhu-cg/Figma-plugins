import { useMemo } from "react";
import type { ScanResult } from "@shared/types";
import { computeDashboardMetrics } from "../../lib/metrics";
import { Donut } from "../Charts/Donut";
import { useLoadMore } from "../../state/useLoadMore";

const PAGE_SIZE = 150;

interface DocumentationViewProps {
  result: ScanResult;
  onSelectNode: (id: string) => void;
}

export function DocumentationView({ result, onSelectNode }: DocumentationViewProps) {
  const metrics = computeDashboardMetrics(result);
  const documented = result.components.filter((c) => c.hasDocumentation);
  const undocumented = result.components.filter((c) => !c.hasDocumentation);

  const docIssuesByComponent = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of result.issues) {
      if (issue.category !== "documentation" || !issue.node?.componentId) continue;
      const list = map.get(issue.node.componentId) ?? [];
      list.push(issue.description);
      map.set(issue.node.componentId, list);
    }
    return map;
  }, [result.issues]);

  const needsWork = useMemo(
    () => result.components.filter((c) => !c.hasDocumentation || docIssuesByComponent.has(c.id)),
    [result.components, docIssuesByComponent]
  );
  const { visible, hasMore, remaining, loadMore } = useLoadMore(needsWork, PAGE_SIZE);

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column" }}>
      <div className="view-header">
        <div>
          <div className="view-title">Documentation</div>
          <div className="view-subtitle">{metrics.documentationCoverage}% of components have a description</div>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ marginBottom: 16, flexShrink: 0 }}>
        <div className="card flex items-center gap-3">
          <Donut
            segments={[
              { label: "Documented", value: documented.length, color: "var(--color-success)" },
              { label: "Undocumented", value: undocumented.length, color: "var(--color-critical)" }
            ]}
            centerLabel={`${metrics.documentationCoverage}%`}
            centerSub="coverage"
          />
          <div style={{ flex: 1 }}>
            <div className="card-title" style={{ marginBottom: 8 }}>
              Coverage
            </div>
            <div style={{ fontSize: 12.5 }}>
              {documented.length} of {result.components.length} components have a description set. Each should cover
              usage, do/don't guidance, accessibility notes, and what each property means.
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 8 }}>
            Expected sections
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
            Usage · Do · Don't · Accessibility · Properties · Token references
          </div>
        </div>
      </div>

      <div
        className="card"
        style={{ padding: 0, overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", fontWeight: 700, flexShrink: 0 }}>
          Components needing documentation work
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>
                    {c.hasDocumentation ? (
                      <span className="badge badge-warning">Incomplete</span>
                    ) : (
                      <span className="badge badge-critical">Missing</span>
                    )}
                  </td>
                  <td className="text-secondary" style={{ maxWidth: 360 }}>
                    {(docIssuesByComponent.get(c.id) ?? []).join(" ") || "No description at all."}
                  </td>
                  <td>
                    <button className="btn btn-ghost btn-sm" onClick={() => onSelectNode(c.id)}>
                      Go to layer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {hasMore && (
            <button className="btn btn-secondary btn-sm" style={{ width: "100%", margin: "8px 0" }} onClick={loadMore}>
              Load {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
