import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeListItem, changeItemDomId } from "@ui/components/ChangeListItem";
import { ChangeDetail } from "@ui/components/ChangeDetail";
import { RenameSuggestionBanner } from "@ui/components/RenameSuggestionBanner";
import { SearchIcon, TrackIcon } from "@ui/components/Icons";
import type { Change, ChangeCategory } from "@shared/types/change";
import type { ReviewState } from "@shared/types/entity";
import { getEffectiveClassification } from "@shared/utils/classification";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";

type EntityFilter = "all" | "components" | "tokens";
type BreakingFilter = "all" | "breaking";
type ReviewFilter = "all" | ReviewState;

const REVIEW_STATE_OPTIONS: ReviewState[] = ["unreviewed", "reviewed", "accepted", "rejected"];
const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  accepted: "Accepted",
  rejected: "Rejected",
};

/** Keyboard shortcut → review decision. */
const REVIEW_KEYS: Record<string, ReviewState> = { a: "accepted", r: "rejected", v: "reviewed", u: "unreviewed" };

/** Something the user can take back: the review states these changes had before the action. */
interface UndoableAction {
  message: string;
  previous: Array<{ changeId: string; state: ReviewState }>;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export function ChangesPage({
  focusChangeId,
  onFocusConsumed,
}: {
  focusChangeId?: string;
  onFocusConsumed?: () => void;
} = {}) {
  const { project, send, scanning } = useProjectState();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ChangeCategory | "all">("all");
  const [entityType, setEntityType] = useState<EntityFilter>("all");
  const [breaking, setBreaking] = useState<BreakingFilter>("all");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<ReviewState>("reviewed");
  const [lastAction, setLastAction] = useState<UndoableAction | null>(null);

  const changeSet = useMemo(() => {
    if (!project?.currentBaselineId) return undefined;
    return getLatestChangeSetForBaseline(project, project.currentBaselineId);
  }, [project]);

  const matchesFilters = useCallback(
    (c: Change) => {
      const effective = getEffectiveClassification(c);
      const q = search.trim().toLowerCase();
      if (category !== "all" && effective.category !== category) return false;
      if (entityType === "components" && c.entityType !== "component") return false;
      if (entityType === "tokens" && c.entityType !== "token") return false;
      if (breaking === "breaking" && !effective.breaking && !effective.potentialBreaking) return false;
      if (reviewFilter !== "all" && c.reviewState !== reviewFilter) return false;
      if (q && !`${c.entityName} ${c.summary}`.toLowerCase().includes(q)) return false;
      return true;
    },
    [search, category, entityType, breaking, reviewFilter],
  );

  const filtered = useMemo(() => (changeSet ? changeSet.changes.filter(matchesFilters) : []), [changeSet, matchesFilters]);

  const filtersActive =
    search !== "" || category !== "all" || entityType !== "all" || breaking !== "all" || reviewFilter !== "all";

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setEntityType("all");
    setBreaking("all");
    setReviewFilter("all");
  }

  useEffect(() => {
    const target = focusChangeId ? changeSet?.changes.find((c) => c.id === focusChangeId) : undefined;
    if (!focusChangeId || !target) return;
    // Only reset filters when they would hide the requested change.
    if (!matchesFilters(target)) clearFilters();
    setSelectedId(focusChangeId);
    onFocusConsumed?.();
  }, [focusChangeId, changeSet]);

  // Keep the selected row in view as the keyboard moves through the list.
  useEffect(() => {
    if (selectedId) document.getElementById(changeItemDomId(selectedId))?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Next unreviewed change after `fromId` (wrapping), excluding `fromId` itself. */
  function nextUnreviewedAfter(fromId: string | null): Change | undefined {
    if (filtered.length === 0) return undefined;
    const start = fromId ? filtered.findIndex((c) => c.id === fromId) : -1;
    for (let step = 1; step <= filtered.length; step++) {
      const candidate = filtered[(start + step + filtered.length) % filtered.length];
      if (candidate && candidate.id !== fromId && candidate.reviewState === "unreviewed") return candidate;
    }
    return undefined;
  }

  function reviewSelected(state: ReviewState) {
    if (!changeSet || !selected || selected.reviewState === state) return;
    const advanceTo =
      state === "unreviewed" ? selected : (nextUnreviewedAfter(selected.id) ?? selected);
    setLastAction({
      message: `${selected.entityName} marked ${REVIEW_STATE_LABEL[state].toLowerCase()}`,
      previous: [{ changeId: selected.id, state: selected.reviewState }],
    });
    send({ type: "update-change", changeSetId: changeSet.id, changeId: selected.id, reviewState: state });
    setSelectedId(advanceTo.id);
  }

  function applyBulk() {
    if (!changeSet || checkedIds.size === 0) return;
    const ids = Array.from(checkedIds);
    setLastAction({
      message: `${ids.length} change${ids.length === 1 ? "" : "s"} marked ${REVIEW_STATE_LABEL[bulkTarget].toLowerCase()}`,
      previous: changeSet.changes.filter((c) => checkedIds.has(c.id)).map((c) => ({ changeId: c.id, state: c.reviewState })),
    });
    send({ type: "bulk-update-review", changeSetId: changeSet.id, changeIds: ids, reviewState: bulkTarget });
    setCheckedIds(new Set());
  }

  function undo() {
    if (!changeSet || !lastAction) return;
    // bulk-update-review sets one state per call, so restore each prior state as a group.
    const byState = new Map<ReviewState, string[]>();
    for (const { changeId, state } of lastAction.previous) {
      byState.set(state, [...(byState.get(state) ?? []), changeId]);
    }
    for (const [reviewState, changeIds] of byState) {
      send({ type: "bulk-update-review", changeSetId: changeSet.id, changeIds, reviewState });
    }
    const first = lastAction.previous[0];
    if (first) setSelectedId(first.changeId);
    setLastAction(null);
  }

  const move = (delta: 1 | -1) => {
    if (filtered.length === 0) return;
    const index = selectedId ? filtered.findIndex((c) => c.id === selectedId) : -1;
    const next = index === -1 ? (delta === 1 ? 0 : filtered.length - 1) : Math.min(filtered.length - 1, Math.max(0, index + delta));
    const target = filtered[next];
    if (target) setSelectedId(target.id);
  };

  const jumpToNextUnreviewed = () => {
    const next = nextUnreviewedAfter(selectedId);
    if (next) setSelectedId(next.id);
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === "arrowdown" || key === "j") move(1);
      else if (key === "arrowup" || key === "k") move(-1);
      else if (key === "n") jumpToNextUnreviewed();
      else if (key === "z" && lastAction) undo();
      else if (key in REVIEW_KEYS && selected) reviewSelected(REVIEW_KEYS[key] as ReviewState);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  if (!project) return null;

  if (!changeSet || changeSet.changes.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No changes detected</div>
        <div className="state-body">
          Edit components or tokens in Figma, then scan to see what changed since your baseline.
        </div>
        <button className="btn btn-primary" disabled={scanning} onClick={() => send({ type: "scan" })}>
          {scanning ? "Scanning…" : "Scan for changes"}
        </button>
      </div>
    );
  }

  const componentCount = changeSet.changes.filter((c) => c.entityType === "component").length;
  const tokenCount = changeSet.changes.filter((c) => c.entityType === "token").length;
  const unreviewedCount = changeSet.changes.filter((c) => c.reviewState === "unreviewed").length;
  const reviewedCount = changeSet.changes.length - unreviewedCount;
  const allChecked = filtered.length > 0 && filtered.every((c) => checkedIds.has(c.id));
  const someChecked = filtered.some((c) => checkedIds.has(c.id));

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, paddingBottom: 12, marginBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Changes</div>
            <div className="view-subtitle">
              {changeSet.changes.length} changes · {componentCount} components · {tokenCount} tokens ·{" "}
              {unreviewedCount} unreviewed · {reviewedCount} reviewed
            </div>
          </div>
        </div>

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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="select-wrapper">
            <select
              className="select"
              aria-label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as ChangeCategory | "all")}
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
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as EntityFilter)}
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
              value={breaking}
              onChange={(e) => setBreaking(e.target.value as BreakingFilter)}
            >
              <option value="all">All changes</option>
              <option value="breaking">Breaking only</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select
              className="select"
              aria-label="Review state"
              value={reviewFilter}
              onChange={(e) => setReviewFilter(e.target.value as ReviewFilter)}
            >
              <option value="all">All review states</option>
              {REVIEW_STATE_OPTIONS.map((state) => (
                <option key={state} value={state}>
                  {REVIEW_STATE_LABEL[state]}
                </option>
              ))}
            </select>
          </div>
          {filtersActive && (
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        {changeSet.scanSummary.skippedItems.length > 0 && (
          <details style={{ marginTop: 12, fontSize: 11.5 }} className="text-secondary">
            <summary>
              {changeSet.scanSummary.componentsScanned + changeSet.scanSummary.tokensScanned} scanned,{" "}
              {changeSet.scanSummary.skippedItems.length} skipped
            </summary>
            <ul style={{ marginTop: 6, paddingLeft: 16 }}>
              {changeSet.scanSummary.skippedItems.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}>
        <RenameSuggestionBanner changeSetId={changeSet.id} changes={changeSet.changes} />

        <div className="sr-only" role="status" aria-live="polite">
          {lastAction?.message ?? ""}
        </div>

        {checkedIds.size > 0 && (
          <div className="card flex items-center justify-between wrap gap-2" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{checkedIds.size} selected</span>
            <div className="flex items-center gap-2">
              <div className="select-wrapper">
                <select
                  className="select"
                  aria-label="Mark selected as"
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value as ReviewState)}
                >
                  {REVIEW_STATE_OPTIONS.map((state) => (
                    <option key={state} value={state}>
                      {REVIEW_STATE_LABEL[state]}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" onClick={applyBulk}>
                Apply
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setCheckedIds(new Set())}>
                Clear
              </button>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="card state-card">
            <div className="text-secondary">No changes match these filters.</div>
            <button className="btn btn-secondary btn-sm" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : (
          <div className="split">
            <div className="flex flex-col gap-2" style={{ paddingRight: 4 }}>
              <div className="flex items-center justify-between gap-2 wrap" style={{ paddingBottom: 4 }}>
                <label className="checkbox-row text-secondary" style={{ fontSize: 12, fontWeight: 600, padding: 0 }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked && !allChecked;
                    }}
                    onChange={() =>
                      setCheckedIds(allChecked ? new Set() : new Set(filtered.map((c) => c.id)))
                    }
                  />
                  Select all {filtered.length}
                </label>
                <button className="btn btn-ghost btn-sm" disabled={unreviewedCount === 0} onClick={jumpToNextUnreviewed}>
                  Next unreviewed <span className="kbd" aria-hidden>N</span>
                </button>
              </div>
              {filtered.map((change) => (
                <ChangeListItem
                  key={change.id}
                  change={change}
                  selected={selectedId === change.id}
                  onSelect={() => setSelectedId(change.id)}
                  checked={checkedIds.has(change.id)}
                  onToggleCheck={() => toggleChecked(change.id)}
                />
              ))}
              <div className="text-tertiary" style={{ fontSize: 11.5, paddingTop: 4 }}>
                <span className="kbd">↑</span> <span className="kbd">↓</span> move · <span className="kbd">A</span> accept ·{" "}
                <span className="kbd">R</span> reject · <span className="kbd">V</span> reviewed ·{" "}
                <span className="kbd">Z</span> undo
              </div>
            </div>
            <ChangeDetail change={selected} changeSetId={changeSet.id} onReview={reviewSelected} />
          </div>
        )}
        {lastAction && (
          <div
            className="card flex items-center justify-between gap-2"
            style={{ position: "sticky", bottom: 0, marginTop: 12, boxShadow: "var(--shadow-md)", zIndex: 5 }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{lastAction.message}</span>
            <button className="btn btn-secondary btn-sm" onClick={undo}>
              Undo <span className="kbd" aria-hidden>Z</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
