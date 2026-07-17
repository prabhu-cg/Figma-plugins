import { useMemo, useState } from "react";
import type { ScanResult } from "@shared/types";
import { SearchIcon } from "../Icons";
import { useLoadMore } from "../../state/useLoadMore";

const PAGE_SIZE = 150;

interface ComponentsViewProps {
  result: ScanResult;
  onSelectNode: (id: string) => void;
}

export function ComponentsView({ result, onSelectNode }: ComponentsViewProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState("all");

  const issueCountByComponent = useMemo(() => {
    const map = new Map<string, number>();
    for (const issue of result.issues) {
      if (!issue.node?.componentId) continue;
      map.set(issue.node.componentId, (map.get(issue.node.componentId) ?? 0) + 1);
    }
    return map;
  }, [result.issues]);

  const pageOptions = useMemo(
    () => Array.from(new Set(result.components.map((c) => c.pageName))).sort((a, b) => a.localeCompare(b)),
    [result.components]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return result.components.filter((c) => {
      if (page !== "all" && c.pageName !== page) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.pageName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [result.components, search, page]);

  const { visible, hasMore, remaining, loadMore } = useLoadMore(filtered, PAGE_SIZE);

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column" }}>
      <div className="view-header">
        <div>
          <div className="view-title">Components</div>
          <div className="view-subtitle">
            {filtered.length} of {result.components.length} components and component sets shown
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 320 }}>
          <SearchIcon style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }} />
          <input
            className="input"
            style={{ paddingLeft: 30, width: "100%" }}
            placeholder="Search components…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {pageOptions.length > 1 && (
          <div className="select-wrapper">
            <select className="select" value={page} onChange={(e) => setPage(e.target.value)}>
              <option value="all">All pages</option>
              {pageOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th title="Auto-detected component type based on its name, used to check for expected interaction states (e.g. hover/focus/disabled)">
                  Kind
                </th>
                <th>Page</th>
                <th>Variants</th>
                <th>States</th>
                <th>Docs</th>
                <th>Issues</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const stateTotal = c.detectedStates.length + c.missingStates.length;
                const hasKind = c.detectedKind && c.detectedKind !== "unknown";
                return (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 700 }}>
                      {c.name}
                      {c.isDeprecated && (
                        <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                          Deprecated
                        </span>
                      )}
                    </td>
                    <td className="text-secondary">
                      {hasKind ? c.detectedKind : <span className="text-tertiary">—</span>}
                    </td>
                    <td className="text-secondary">{c.pageName}</td>
                    <td>{c.variantCount}</td>
                    <td>
                      {stateTotal > 0 ? (
                        <span className={c.missingStates.length > 0 ? "text-secondary" : ""}>
                          {c.detectedStates.length}/{stateTotal}
                        </span>
                      ) : (
                        <span className="text-tertiary">—</span>
                      )}
                    </td>
                    <td>
                      {c.hasDocumentation ? (
                        <span className="badge badge-success">Yes</span>
                      ) : (
                        <span className="badge badge-neutral">No</span>
                      )}
                    </td>
                    <td>{issueCountByComponent.get(c.id) ?? 0}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => onSelectNode(c.id)}>
                        Go to layer
                      </button>
                    </td>
                  </tr>
                );
              })}
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
