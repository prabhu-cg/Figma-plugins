import React, { useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { buildSearchIndex, searchIndex, type SearchResult, type SearchResultType } from "@shared/utils/search";
import { SearchIcon } from "./Icons";
import type { PageId } from "@ui/App";

const TYPE_LABEL: Record<SearchResultType, string> = {
  component: "Component",
  token: "Token",
  release: "Release",
  change: "Change",
  deprecated: "Deprecated",
};

function targetPage(type: SearchResultType): PageId {
  return type === "change" ? "changes" : "history";
}

/** Global search (spec §16) — substring match across everything DSLog tracks, grouped by entity type. */
export function SearchBar({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { project } = useProjectState();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const index = useMemo(() => (project ? buildSearchIndex(project) : []), [project]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);

  function select(result: SearchResult) {
    onNavigate(targetPage(result.type));
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
            right: 0,
            zIndex: 20,
            padding: 6,
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {results.length === 0 ? (
            <div className="text-secondary" style={{ fontSize: 12, padding: 8 }}>
              No matches.
            </div>
          ) : (
            results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                className="btn btn-ghost btn-sm"
                style={{ width: "100%", justifyContent: "flex-start", textAlign: "left" }}
                onClick={() => select(result)}
              >
                <span className="badge badge-neutral" style={{ marginRight: 8 }}>
                  {TYPE_LABEL[result.type]}
                </span>
                <span style={{ fontWeight: 600 }}>{result.label}</span>
                {result.sublabel && (
                  <span className="text-tertiary" style={{ marginLeft: 6, fontSize: 11 }}>
                    {result.sublabel}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
