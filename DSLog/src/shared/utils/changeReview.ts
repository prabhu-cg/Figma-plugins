import type { Change, ChangeCategory } from "@shared/types/change";
import type { ReviewState } from "@shared/types/entity";
import { getEffectiveClassification } from "./classification";

/**
 * Pure logic behind the Changes page — filtering, keyboard selection, review auto-advance and undo —
 * kept free of React so it can be unit-tested without a DOM.
 */

export type EntityFilter = "all" | "components" | "tokens";
export type BreakingFilter = "all" | "breaking";
export type ReviewFilter = "all" | ReviewState;

export interface ChangeFilters {
  search: string;
  category: ChangeCategory | "all";
  entityType: EntityFilter;
  breaking: BreakingFilter;
  reviewState: ReviewFilter;
}

export const DEFAULT_CHANGE_FILTERS: ChangeFilters = {
  search: "",
  category: "all",
  entityType: "all",
  breaking: "all",
  reviewState: "all",
};

export const REVIEW_STATES: ReviewState[] = ["unreviewed", "reviewed", "accepted", "rejected"];

export const REVIEW_STATE_LABEL: Record<ReviewState, string> = {
  unreviewed: "Unreviewed",
  reviewed: "Reviewed",
  accepted: "Accepted",
  rejected: "Rejected",
};

/** Keyboard shortcut → review decision (a/r/v/u). */
const REVIEW_KEYS: Record<string, ReviewState> = { a: "accepted", r: "rejected", v: "reviewed", u: "unreviewed" };

export function reviewStateForKey(key: string): ReviewState | undefined {
  return REVIEW_KEYS[key.toLowerCase()];
}

export function areFiltersActive(filters: ChangeFilters): boolean {
  return (Object.keys(DEFAULT_CHANGE_FILTERS) as Array<keyof ChangeFilters>).some(
    (key) => filters[key] !== DEFAULT_CHANGE_FILTERS[key],
  );
}

export function matchesFilters(change: Change, filters: ChangeFilters): boolean {
  const effective = getEffectiveClassification(change);
  const q = filters.search.trim().toLowerCase();
  if (filters.category !== "all" && effective.category !== filters.category) return false;
  if (filters.entityType === "components" && change.entityType !== "component") return false;
  if (filters.entityType === "tokens" && change.entityType !== "token") return false;
  if (filters.breaking === "breaking" && !effective.breaking && !effective.potentialBreaking) return false;
  if (filters.reviewState !== "all" && change.reviewState !== filters.reviewState) return false;
  if (q && !`${change.entityName} ${change.summary}`.toLowerCase().includes(q)) return false;
  return true;
}

export function filterChanges(changes: Change[], filters: ChangeFilters): Change[] {
  return changes.filter((change) => matchesFilters(change, filters));
}

/**
 * The next unreviewed change after `fromId`, wrapping around the list. `fromId` itself is never
 * returned, and with no `fromId` the search starts at the top.
 */
export function nextUnreviewedAfter(list: Change[], fromId: string | null): Change | undefined {
  if (list.length === 0) return undefined;
  const start = fromId ? list.findIndex((c) => c.id === fromId) : -1;
  for (let step = 1; step <= list.length; step++) {
    const candidate = list[(start + step + list.length) % list.length];
    if (candidate && candidate.id !== fromId && candidate.reviewState === "unreviewed") return candidate;
  }
  return undefined;
}

/** Arrow-key / J-K movement: stops at the ends, and starts from the top or bottom when nothing is selected. */
export function moveSelection(list: Change[], selectedId: string | null, delta: 1 | -1): string | null {
  if (list.length === 0) return null;
  const index = selectedId ? list.findIndex((c) => c.id === selectedId) : -1;
  const next = index === -1 ? (delta === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + delta));
  return list[next]?.id ?? null;
}

/**
 * Which change to select after reviewing `selected` as `state`: the next unreviewed one (so reviewing is
 * a steady rhythm), staying put when nothing is left or when the decision is "unreviewed" (a reset).
 */
export function selectionAfterReview(list: Change[], selected: Change, state: ReviewState): string {
  if (state === "unreviewed") return selected.id;
  return (nextUnreviewedAfter(list, selected.id) ?? selected).id;
}

/** What a change's review state was before an action, so the action can be undone. */
export interface PreviousReviewState {
  changeId: string;
  state: ReviewState;
}

/**
 * bulk-update-review applies one state to many changes, so undoing a mixed selection takes one call per
 * prior state. Groups keep first-seen order, and ids keep the order they were recorded in.
 */
export function groupPreviousStates(previous: PreviousReviewState[]): Array<{ reviewState: ReviewState; changeIds: string[] }> {
  const groups = new Map<ReviewState, string[]>();
  for (const { changeId, state } of previous) {
    groups.set(state, [...(groups.get(state) ?? []), changeId]);
  }
  return Array.from(groups, ([reviewState, changeIds]) => ({ reviewState, changeIds }));
}

export function snapshotReviewStates(changes: Change[], ids: ReadonlySet<string>): PreviousReviewState[] {
  return changes.filter((c) => ids.has(c.id)).map((c) => ({ changeId: c.id, state: c.reviewState }));
}

export type KeyAction =
  | { type: "move"; delta: 1 | -1 }
  | { type: "next-unreviewed" }
  | { type: "undo" }
  | { type: "review"; state: ReviewState };

/**
 * What a keypress on the Changes page should do, or null to leave it alone. Shortcuts never fire while the
 * user is typing in a field or holding a modifier (so ⌘A / ⌘Z keep their normal meaning), review keys need a
 * selected change, and undo needs something to undo.
 */
export function keyAction(
  key: string,
  context: { typing: boolean; modifier: boolean; hasSelection: boolean; canUndo: boolean },
): KeyAction | null {
  if (context.typing || context.modifier) return null;
  const k = key.toLowerCase();
  if (k === "arrowdown" || k === "j") return { type: "move", delta: 1 };
  if (k === "arrowup" || k === "k") return { type: "move", delta: -1 };
  if (k === "n") return { type: "next-unreviewed" };
  if (k === "z") return context.canUndo ? { type: "undo" } : null;
  const state = reviewStateForKey(k);
  return state && context.hasSelection ? { type: "review", state } : null;
}
