import { AUDIT_CATEGORIES, CATEGORY_LABELS, type AuditCategory, type IssueStatus, type Severity } from "@shared/types";
import { SearchIcon } from "../Icons";
import { DEFAULT_FILTERS, SORT_OPTIONS, type countFacets, type FiltersState, type SortKey } from "../../lib/issueView";

interface FiltersProps {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  componentOptions: { id: string; name: string }[];
  collectionOptions: string[];
  facets: ReturnType<typeof countFacets>;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
}

export function Filters({ value, onChange, componentOptions, collectionOptions, facets, sort, onSortChange }: FiltersProps) {
  const isDirty =
    value.search ||
    value.category !== "all" ||
    value.severity !== "all" ||
    value.componentId !== "all" ||
    value.status !== "all" ||
    value.collection !== "all";

  return (
    <div className="flex items-center gap-2 wrap" style={{ marginBottom: 16 }}>
      <div style={{ position: "relative", flex: "1 1 200px" }}>
        <SearchIcon
          style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
        />
        <input
          className="input"
          type="search"
          aria-label="Search issues"
          style={{ paddingLeft: 30, width: "100%" }}
          placeholder="Search issues…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Filter by module"
          value={value.category}
          onChange={(e) => onChange({ ...value, category: e.target.value as AuditCategory | "all" })}
        >
          <option value="all">All modules</option>
          {AUDIT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Filter by severity"
          value={value.severity}
          onChange={(e) => onChange({ ...value, severity: e.target.value as Severity | "all" })}
        >
          <option value="all">All severities</option>
          <option value="critical">Critical ({facets.severity.critical})</option>
          <option value="warning">Warning ({facets.severity.warning})</option>
          <option value="suggestion">Suggestion ({facets.severity.suggestion})</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Filter by status"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as IssueStatus | "all" })}
        >
          <option value="all">All statuses</option>
          <option value="open">Open ({facets.status.open})</option>
          <option value="resolved">Resolved ({facets.status.resolved})</option>
          <option value="ignored">Ignored ({facets.status.ignored})</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select className="select" aria-label="Filter by component" value={value.componentId} onChange={(e) => onChange({ ...value, componentId: e.target.value })}>
          <option value="all">All components</option>
          {componentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {collectionOptions.length > 0 && (
        <div className="select-wrapper">
          <select className="select" aria-label="Filter by collection" value={value.collection} onChange={(e) => onChange({ ...value, collection: e.target.value })}>
            <option value="all">All collections</option>
            {collectionOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Sort issues by"
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              Sort: {o.label}
            </option>
          ))}
        </select>
      </div>
      {isDirty && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(DEFAULT_FILTERS)}>
          Clear
        </button>
      )}
    </div>
  );
}
