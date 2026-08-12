import React, { useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { buildSearchIndex, groupSearchResults, searchIndex, type SearchResult, type SearchResultType } from "@shared/utils/search";
import { SearchIcon } from "./Icons";

const GROUP_LABEL: Record<SearchResultType, string> = {
  component: "Components",
  token: "Tokens",
  release: "Releases",
  change: "Changes",
  deprecated: "Deprecated",
};

const RESULTS_PER_GROUP = 5;

/**
 * Global search (spec §16) — substring match across everything DSLog
 * tracks, grouped by entity type rather than one flat list, so a common
 * term (e.g. a component name that also matches a dozen of its own change
 * summaries) doesn't crowd out every other kind of result. Reports the
 * picked result up rather than deciding navigation itself — the parent
 * (App.tsx) owns what "jump to this" means for each entity type.
 */
export function SearchBar({ onSelectResult }: { onSelectResult: (result: SearchResult) => void }) {
  const { project } = useProjectState();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const index = useMemo(() => (project ? buildSearchIndex(project) : []), [project]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const groups = useMemo(() => groupSearchResults(results, RESULTS_PER_GROUP), [results]);

  function select(result: SearchResult) {
    onSelectResult(result);
    setQuery("");
    setFocused(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <SearchIcon
        style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
      />
      <input
        className="input"
        style={{ paddingLeft: 30, width: "100%" }}
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {focused && query.trim() && (
        <div
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: 340,
            zIndex: 20,
            padding: 6,
            maxHeight: 420,
            overflowY: "auto",
            boxShadow: "var(--shadow-md)",
          }}
        >
          {groups.length === 0 ? (
            <div className="text-secondary" style={{ fontSize: 12, padding: 8 }}>
              No matches.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.type} style={{ marginBottom: 4 }}>
                <div
                  className="text-tertiary"
                  style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", padding: "6px 8px 2px" }}
                >
                  {GROUP_LABEL[group.type]}
                </div>
                {group.items.map((result) => (
                  <button
                    key={`${result.type}-${result.id}`}
                    className="btn btn-ghost btn-sm"
                    style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", textAlign: "left", padding: "6px 8px" }}
                    onClick={() => select(result)}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12.5, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {result.label}
                    </span>
                    {result.sublabel && (
                      <span
                        className="text-tertiary"
                        style={{ fontSize: 11, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      >
                        {result.sublabel}
                      </span>
                    )}
                  </button>
                ))}
                {group.totalCount > RESULTS_PER_GROUP && (
                  <div className="text-tertiary" style={{ fontSize: 10.5, padding: "2px 8px 4px" }}>
                    +{group.totalCount - RESULTS_PER_GROUP} more — refine your search
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
