import { AUDIT_CATEGORIES, CATEGORY_LABELS, type AuditCategory, type IssueStatus, type Severity } from "@shared/types";
import { SearchIcon } from "../Icons";

export interface FiltersState {
  search: string;
  category: AuditCategory | "all";
  severity: Severity | "all";
  componentId: string | "all";
  status: IssueStatus | "all";
  collection: string | "all";
}

export const DEFAULT_FILTERS: FiltersState = {
  search: "",
  category: "all",
  severity: "all",
  componentId: "all",
  status: "all",
  collection: "all"
};

interface FiltersProps {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  componentOptions: { id: string; name: string }[];
  collectionOptions: string[];
}

export function Filters({ value, onChange, componentOptions, collectionOptions }: FiltersProps) {
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
          style={{ paddingLeft: 30, width: "100%" }}
          placeholder="Search issues…"
          value={value.search}
          onChange={(e) => onChange({ ...value, search: e.target.value })}
        />
      </div>
      <div className="select-wrapper">
        <select
          className="select"
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
          value={value.severity}
          onChange={(e) => onChange({ ...value, severity: e.target.value as Severity | "all" })}
        >
          <option value="all">All severities</option>
          <option value="critical">Critical</option>
          <option value="warning">Warning</option>
          <option value="suggestion">Suggestion</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value as IssueStatus | "all" })}
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
          <option value="ignored">Ignored</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select className="select" value={value.componentId} onChange={(e) => onChange({ ...value, componentId: e.target.value })}>
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
          <select className="select" value={value.collection} onChange={(e) => onChange({ ...value, collection: e.target.value })}>
            <option value="all">All collections</option>
            {collectionOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}
      {isDirty && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange(DEFAULT_FILTERS)}>
          Clear
        </button>
      )}
    </div>
  );
}
