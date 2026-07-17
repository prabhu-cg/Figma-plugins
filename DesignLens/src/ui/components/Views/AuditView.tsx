import { useMemo, useState } from "react";
import type { Issue, IssueStatus, ScanResult } from "@shared/types";
import { DEFAULT_FILTERS, Filters, type FiltersState } from "../Filters/Filters";
import { IssueList } from "../IssueList/IssueList";
import { IssueDetail } from "../IssueList/IssueDetail";
import { useLoadMore } from "../../state/useLoadMore";

const PAGE_SIZE = 100;

interface AuditViewProps {
  result: ScanResult;
  onSelectNode: (id: string) => void;
  onSetIssueStatus: (issue: Issue, status: IssueStatus) => void;
}

export function AuditView({ result, onSelectNode, onSetIssueStatus }: AuditViewProps) {
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const componentOptions = useMemo(
    () => result.components.map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [result.components]
  );

  const collectionOptions = useMemo(
    () =>
      Array.from(new Set(result.issues.map((i) => i.collection).filter((c): c is string => !!c))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [result.issues]
  );

  const filteredIssues = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    return result.issues.filter((issue) => {
      if (filters.category !== "all" && issue.category !== filters.category) return false;
      if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
      if (filters.componentId !== "all" && issue.node?.componentId !== filters.componentId) return false;
      if (filters.status !== "all" && issue.status !== filters.status) return false;
      if (filters.collection !== "all" && issue.collection !== filters.collection) return false;
      if (search) {
        const haystack = `${issue.title} ${issue.description} ${issue.node?.componentName ?? ""}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      return true;
    });
  }, [result.issues, filters]);

  const { visible, hasMore, remaining, loadMore } = useLoadMore(filteredIssues, PAGE_SIZE);
  const selectedIssue = filteredIssues.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, paddingBottom: 12, marginBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Audit</div>
            <div className="view-subtitle">
              {filteredIssues.length} of {result.issues.length} issues shown
            </div>
          </div>
        </div>

        <Filters
          value={filters}
          onChange={setFilters}
          componentOptions={componentOptions}
          collectionOptions={collectionOptions}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}>
        <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
          <div style={{ paddingRight: 4 }}>
            <IssueList issues={visible} selectedId={selectedId} onSelect={setSelectedId} />
            {hasMore && (
              <button className="btn btn-secondary btn-sm" style={{ width: "100%", marginTop: 8 }} onClick={loadMore}>
                Load {Math.min(PAGE_SIZE, remaining)} more ({remaining} remaining)
              </button>
            )}
          </div>
          <IssueDetail issue={selectedIssue} onSelectNode={onSelectNode} onSetStatus={onSetIssueStatus} />
        </div>
      </div>
    </div>
  );
}
