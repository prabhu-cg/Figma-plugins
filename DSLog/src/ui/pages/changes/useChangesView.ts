import { useCallback, useEffect, useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { changeItemDomId } from "@ui/components/ChangeListItem";
import type { ChangeSet } from "@shared/types/change";
import type { ReviewState } from "@shared/types/entity";
import {
  areFiltersActive,
  DEFAULT_CHANGE_FILTERS,
  filterChanges,
  groupPreviousStates,
  keyAction,
  matchesFilters,
  moveSelection,
  nextUnreviewedAfter,
  REVIEW_STATE_LABEL,
  selectionAfterReview,
  snapshotReviewStates,
  type ChangeFilters,
  type PreviousReviewState,
} from "@shared/utils/changeReview";

/** Something the user can take back: the message to show, and the review states before the action. */
export interface UndoableAction {
  message: string;
  previous: PreviousReviewState[];
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * State and behaviour of the Changes page: filters, selection, bulk checks, review decisions with
 * auto-advance, undo, and the keyboard shortcuts. The decisions themselves live in
 * `@shared/utils/changeReview` (unit-tested); this hook only wires them to React state and `send`.
 */
export function useChangesView(changeSet: ChangeSet | undefined, focusChangeId?: string, onFocusConsumed?: () => void) {
  const { send } = useProjectState();
  const [filters, setFilters] = useState<ChangeFilters>(DEFAULT_CHANGE_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkTarget, setBulkTarget] = useState<ReviewState>("reviewed");
  const [lastAction, setLastAction] = useState<UndoableAction | null>(null);

  const filtered = useMemo(() => (changeSet ? filterChanges(changeSet.changes, filters) : []), [changeSet, filters]);
  const selected = filtered.find((c) => c.id === selectedId) ?? null;
  const filtersActive = areFiltersActive(filters);

  const setFilter = useCallback(<K extends keyof ChangeFilters>(key: K, value: ChangeFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);
  const clearFilters = useCallback(() => setFilters(DEFAULT_CHANGE_FILTERS), []);

  // A search result jumps here: select it, and only reset filters when they would hide it.
  useEffect(() => {
    const target = focusChangeId ? changeSet?.changes.find((c) => c.id === focusChangeId) : undefined;
    if (!focusChangeId || !target) return;
    if (!matchesFilters(target, filters)) setFilters(DEFAULT_CHANGE_FILTERS);
    setSelectedId(focusChangeId);
    onFocusConsumed?.();
  }, [focusChangeId, changeSet]);

  // Keep the selected row in view as the keyboard moves through the list.
  useEffect(() => {
    if (selectedId) document.getElementById(changeItemDomId(selectedId))?.scrollIntoView({ block: "nearest" });
  }, [selectedId]);

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllChecked() {
    const allChecked = filtered.length > 0 && filtered.every((c) => checkedIds.has(c.id));
    setCheckedIds(allChecked ? new Set() : new Set(filtered.map((c) => c.id)));
  }

  function reviewSelected(state: ReviewState) {
    if (!changeSet || !selected || selected.reviewState === state) return;
    const advanceTo = selectionAfterReview(filtered, selected, state);
    setLastAction({
      message: `${selected.entityName} marked ${REVIEW_STATE_LABEL[state].toLowerCase()}`,
      previous: [{ changeId: selected.id, state: selected.reviewState }],
    });
    send({ type: "update-change", changeSetId: changeSet.id, changeId: selected.id, reviewState: state });
    setSelectedId(advanceTo);
  }

  function applyBulk() {
    if (!changeSet || checkedIds.size === 0) return;
    const ids = Array.from(checkedIds);
    setLastAction({
      message: `${ids.length} change${ids.length === 1 ? "" : "s"} marked ${REVIEW_STATE_LABEL[bulkTarget].toLowerCase()}`,
      previous: snapshotReviewStates(changeSet.changes, checkedIds),
    });
    send({ type: "bulk-update-review", changeSetId: changeSet.id, changeIds: ids, reviewState: bulkTarget });
    setCheckedIds(new Set());
  }

  function undo() {
    if (!changeSet || !lastAction) return;
    for (const { reviewState, changeIds } of groupPreviousStates(lastAction.previous)) {
      send({ type: "bulk-update-review", changeSetId: changeSet.id, changeIds, reviewState });
    }
    const first = lastAction.previous[0];
    if (first) setSelectedId(first.changeId);
    setLastAction(null);
  }

  function jumpToNextUnreviewed() {
    const next = nextUnreviewedAfter(filtered, selectedId);
    if (next) setSelectedId(next.id);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const action = keyAction(event.key, {
        typing: isTypingTarget(event.target),
        modifier: event.metaKey || event.ctrlKey || event.altKey,
        hasSelection: selected !== null,
        canUndo: lastAction !== null,
      });
      if (!action) return;
      event.preventDefault();
      if (action.type === "move") {
        const next = moveSelection(filtered, selectedId, action.delta);
        if (next) setSelectedId(next);
      } else if (action.type === "next-unreviewed") jumpToNextUnreviewed();
      else if (action.type === "undo") undo();
      else reviewSelected(action.state);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return {
    filters,
    setFilter,
    clearFilters,
    filtersActive,
    filtered,
    selected,
    selectedId,
    setSelectedId,
    checkedIds,
    setCheckedIds,
    toggleChecked,
    toggleAllChecked,
    bulkTarget,
    setBulkTarget,
    applyBulk,
    lastAction,
    undo,
    reviewSelected,
    jumpToNextUnreviewed,
  };
}

export type ChangesView = ReturnType<typeof useChangesView>;
