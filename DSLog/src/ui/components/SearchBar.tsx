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
  const [activeIndex, setActiveIndex] = useState(0);

  const index = useMemo(() => (project ? buildSearchIndex(project) : []), [project]);
  const results = useMemo(() => searchIndex(index, query), [index, query]);
  const groups = useMemo(() => groupSearchResults(results, RESULTS_PER_GROUP), [results]);
  // Options in the order they're rendered, so arrow keys walk the visible list across groups.
  const options = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const open = focused && query.trim() !== "";
  const optionId = (i: number) => `search-option-${i}`;

  function select(result: SearchResult) {
    onSelectResult(result);
    setQuery("");
    setFocused(false);
    setActiveIndex(0);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setFocused(false);
      return;
    }
    if (!open || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = options[activeIndex];
      if (chosen) select(chosen);
    }
  }

  let optionCounter = -1;

  return (
    <div style={{ position: "relative" }}>
      <SearchIcon
        aria-hidden
        style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
      />
      <input
        className="input"
        style={{ paddingLeft: 30, width: "100%" }}
        placeholder="Search…"
        role="combobox"
        aria-label="Search components, tokens, releases and changes"
        aria-expanded={open}
        aria-controls="search-listbox"
        aria-autocomplete="list"
        aria-activedescendant={open && options.length > 0 ? optionId(activeIndex) : undefined}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActiveIndex(0);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
      />
      {open && (
        <div
          className="card"
          id="search-listbox"
          role="listbox"
          aria-label="Search results"
          // Keep focus in the input so clicking a result registers before blur closes the list.
          onMouseDown={(e) => e.preventDefault()}
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
            <div className="text-secondary" role="status" style={{ fontSize: 12, padding: 8 }}>
              No matches.
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.type} role="group" aria-label={GROUP_LABEL[group.type]} style={{ marginBottom: 4 }}>
                <div className="search-group-label" aria-hidden>
                  {GROUP_LABEL[group.type]}
                </div>
                {group.items.map((result) => {
                  optionCounter += 1;
                  const i = optionCounter;
                  return (
                    <div
                      key={`${result.type}-${result.id}`}
                      id={optionId(i)}
                      role="option"
                      aria-selected={i === activeIndex}
                      className="search-option"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => select(result)}
                      style={{ cursor: "pointer" }}
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
                    </div>
                  );
                })}
                {group.totalCount > RESULTS_PER_GROUP && (
                  <div className="text-tertiary" style={{ fontSize: 11, padding: "2px 8px 4px" }}>
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
