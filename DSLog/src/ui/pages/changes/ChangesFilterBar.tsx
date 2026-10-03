import { SearchIcon } from "@ui/components/Icons";
import type { ChangeCategory } from "@shared/types/change";
import {
  REVIEW_STATES,
  REVIEW_STATE_LABEL,
  type BreakingFilter,
  type EntityFilter,
  type ReviewFilter,
} from "@shared/utils/changeReview";
import type { ChangesView } from "./useChangesView";

export function ChangesFilterBar({ view }: { view: ChangesView }) {
  const { filters, setFilter } = view;
  return (
    <div className="flex items-center gap-2 wrap">
      <div style={{ position: "relative", flex: "1 1 200px" }}>
        <SearchIcon
          aria-hidden
          style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
        />
        <input
          className="input"
          style={{ paddingLeft: 30, width: "100%" }}
          placeholder="Search changes…"
          aria-label="Search changes"
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Category"
          value={filters.category}
          onChange={(e) => setFilter("category", e.target.value as ChangeCategory | "all")}
        >
          <option value="all">All categories</option>
          <option value="added">Added</option>
          <option value="modified">Changed</option>
          <option value="removed">Removed</option>
          <option value="deprecated">Deprecated</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Entity type"
          value={filters.entityType}
          onChange={(e) => setFilter("entityType", e.target.value as EntityFilter)}
        >
          <option value="all">All entities</option>
          <option value="components">Components</option>
          <option value="tokens">Tokens</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Breaking"
          value={filters.breaking}
          onChange={(e) => setFilter("breaking", e.target.value as BreakingFilter)}
        >
          <option value="all">All changes</option>
          <option value="breaking">Breaking only</option>
        </select>
      </div>
      <div className="select-wrapper">
        <select
          className="select"
          aria-label="Review state"
          value={filters.reviewState}
          onChange={(e) => setFilter("reviewState", e.target.value as ReviewFilter)}
        >
          <option value="all">All review states</option>
          {REVIEW_STATES.map((state) => (
            <option key={state} value={state}>
              {REVIEW_STATE_LABEL[state]}
            </option>
          ))}
        </select>
      </div>
      {view.filtersActive && (
        <button className="btn btn-ghost btn-sm" onClick={view.clearFilters}>
          Clear filters
        </button>
      )}
    </div>
  );
}
