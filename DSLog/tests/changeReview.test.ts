import { describe, expect, it } from "vitest";
import type { Change } from "@shared/types/change";
import type { ReviewState } from "@shared/types/entity";
import {
  areFiltersActive,
  DEFAULT_CHANGE_FILTERS,
  filterChanges,
  keyAction,
  groupPreviousStates,
  matchesFilters,
  moveSelection,
  nextUnreviewedAfter,
  reviewStateForKey,
  selectionAfterReview,
  snapshotReviewStates,
} from "@shared/utils/changeReview";

function change(id: string, overrides: Partial<Change> = {}): Change {
  return {
    id,
    entityType: "component",
    entityId: `e-${id}`,
    entityName: `Entity ${id}`,
    category: "modified",
    severity: "minor",
    changeType: "property-changed",
    summary: `Summary ${id}`,
    breaking: false,
    potentialBreaking: false,
    reviewState: "unreviewed",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as Change;
}

const states = (list: Change[], ...s: ReviewState[]) => list.forEach((c, i) => (c.reviewState = s[i] ?? "unreviewed"));

describe("reviewStateForKey", () => {
  it("maps a/r/v/u in either case and ignores everything else", () => {
    expect(reviewStateForKey("a")).toBe("accepted");
    expect(reviewStateForKey("R")).toBe("rejected");
    expect(reviewStateForKey("v")).toBe("reviewed");
    expect(reviewStateForKey("U")).toBe("unreviewed");
    expect(reviewStateForKey("x")).toBeUndefined();
    expect(reviewStateForKey("ArrowDown")).toBeUndefined();
  });
});

describe("filters", () => {
  const added = change("1", { category: "added", entityName: "Button" });
  const removedBreaking = change("2", { category: "removed", breaking: true, entityName: "Card" });
  const token = change("3", { entityType: "token", entityName: "color.primary", summary: "Value changed" });
  const potential = change("4", { potentialBreaking: true, reviewState: "accepted" });
  const all = [added, removedBreaking, token, potential];

  it("default filters match everything and are not 'active'", () => {
    expect(filterChanges(all, DEFAULT_CHANGE_FILTERS)).toEqual(all);
    expect(areFiltersActive(DEFAULT_CHANGE_FILTERS)).toBe(false);
  });

  it("filters by category, entity type and review state", () => {
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, category: "added" })).toEqual([added]);
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, entityType: "tokens" })).toEqual([token]);
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, entityType: "components" })).toHaveLength(3);
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, reviewState: "accepted" })).toEqual([potential]);
  });

  it("'breaking only' includes potentially-breaking changes", () => {
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, breaking: "breaking" })).toEqual([removedBreaking, potential]);
  });

  it("search is case-insensitive over name and summary and trims whitespace", () => {
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, search: "  BUTTON " })).toEqual([added]);
    expect(filterChanges(all, { ...DEFAULT_CHANGE_FILTERS, search: "value changed" })).toEqual([token]);
  });

  it("uses the manual classification override, not the machine one", () => {
    const overridden = change("5", {
      category: "added",
      manualClassification: { category: "removed", breaking: true, potentialBreaking: false, overriddenAt: "x" },
    } as Partial<Change>);
    expect(matchesFilters(overridden, { ...DEFAULT_CHANGE_FILTERS, category: "removed" })).toBe(true);
    expect(matchesFilters(overridden, { ...DEFAULT_CHANGE_FILTERS, category: "added" })).toBe(false);
    expect(matchesFilters(overridden, { ...DEFAULT_CHANGE_FILTERS, breaking: "breaking" })).toBe(true);
  });

  it("any non-default filter counts as active", () => {
    expect(areFiltersActive({ ...DEFAULT_CHANGE_FILTERS, search: "x" })).toBe(true);
    expect(areFiltersActive({ ...DEFAULT_CHANGE_FILTERS, reviewState: "rejected" })).toBe(true);
  });
});

describe("nextUnreviewedAfter", () => {
  const list = ["a", "b", "c", "d"].map((id) => change(id));

  it("returns the next unreviewed change after the given one", () => {
    states(list, "unreviewed", "accepted", "unreviewed", "unreviewed");
    expect(nextUnreviewedAfter(list, "a")?.id).toBe("c");
  });

  it("wraps around to the start", () => {
    states(list, "unreviewed", "accepted", "accepted", "accepted");
    expect(nextUnreviewedAfter(list, "d")?.id).toBe("a");
  });

  it("never returns the starting change, even when it is the only unreviewed one", () => {
    states(list, "accepted", "unreviewed", "accepted", "accepted");
    expect(nextUnreviewedAfter(list, "b")).toBeUndefined();
  });

  it("starts at the top when nothing is selected", () => {
    states(list, "accepted", "unreviewed", "unreviewed", "unreviewed");
    expect(nextUnreviewedAfter(list, null)?.id).toBe("b");
  });

  it("treats an id that is no longer in the list as 'start from the top'", () => {
    states(list, "unreviewed", "unreviewed", "unreviewed", "unreviewed");
    expect(nextUnreviewedAfter(list, "gone")?.id).toBe("a");
  });

  it("returns undefined for an empty list or when everything is reviewed", () => {
    expect(nextUnreviewedAfter([], null)).toBeUndefined();
    states(list, "accepted", "rejected", "reviewed", "accepted");
    expect(nextUnreviewedAfter(list, "a")).toBeUndefined();
  });
});

describe("moveSelection", () => {
  const list = ["a", "b", "c"].map((id) => change(id));

  it("moves down and up and clamps at the ends", () => {
    expect(moveSelection(list, "a", 1)).toBe("b");
    expect(moveSelection(list, "c", 1)).toBe("c");
    expect(moveSelection(list, "b", -1)).toBe("a");
    expect(moveSelection(list, "a", -1)).toBe("a");
  });

  it("selects the first row going down and the last going up when nothing is selected", () => {
    expect(moveSelection(list, null, 1)).toBe("a");
    expect(moveSelection(list, null, -1)).toBe("c");
    expect(moveSelection(list, "filtered-out", 1)).toBe("a");
  });

  it("returns null for an empty list", () => {
    expect(moveSelection([], null, 1)).toBeNull();
  });
});

describe("selectionAfterReview", () => {
  const list = ["a", "b", "c"].map((id) => change(id));

  it("advances to the next unreviewed change after accepting, rejecting or marking reviewed", () => {
    states(list, "unreviewed", "unreviewed", "unreviewed");
    for (const state of ["accepted", "rejected", "reviewed"] as const) {
      expect(selectionAfterReview(list, list[0]!, state)).toBe("b");
    }
  });

  it("skips changes that are already reviewed", () => {
    states(list, "unreviewed", "accepted", "unreviewed");
    expect(selectionAfterReview(list, list[0]!, "accepted")).toBe("c");
  });

  it("stays on the change when nothing else is left to review", () => {
    states(list, "unreviewed", "accepted", "rejected");
    expect(selectionAfterReview(list, list[0]!, "accepted")).toBe("a");
  });

  it("stays on the change when resetting to unreviewed", () => {
    states(list, "accepted", "unreviewed", "unreviewed");
    expect(selectionAfterReview(list, list[0]!, "unreviewed")).toBe("a");
  });
});

describe("undo grouping", () => {
  it("groups prior states so each can be restored with one bulk call", () => {
    const groups = groupPreviousStates([
      { changeId: "a", state: "unreviewed" },
      { changeId: "b", state: "accepted" },
      { changeId: "c", state: "unreviewed" },
      { changeId: "d", state: "rejected" },
    ]);
    expect(groups).toEqual([
      { reviewState: "unreviewed", changeIds: ["a", "c"] },
      { reviewState: "accepted", changeIds: ["b"] },
      { reviewState: "rejected", changeIds: ["d"] },
    ]);
  });

  it("returns nothing for an empty action", () => {
    expect(groupPreviousStates([])).toEqual([]);
  });

  it("snapshots only the selected changes, in list order", () => {
    const list = ["a", "b", "c"].map((id) => change(id));
    states(list, "accepted", "unreviewed", "rejected");
    expect(snapshotReviewStates(list, new Set(["c", "a", "missing"]))).toEqual([
      { changeId: "a", state: "accepted" },
      { changeId: "c", state: "rejected" },
    ]);
  });

  it("round-trips: restoring every group returns each change to its prior state", () => {
    const list = ["a", "b", "c"].map((id) => change(id));
    states(list, "accepted", "unreviewed", "rejected");
    const before = snapshotReviewStates(list, new Set(list.map((c) => c.id)));
    list.forEach((c) => (c.reviewState = "reviewed")); // the action
    for (const { reviewState, changeIds } of groupPreviousStates(before)) {
      list.filter((c) => changeIds.includes(c.id)).forEach((c) => (c.reviewState = reviewState));
    }
    expect(list.map((c) => c.reviewState)).toEqual(["accepted", "unreviewed", "rejected"]);
  });
});

describe("keyAction", () => {
  const ctx = { typing: false, modifier: false, hasSelection: true, canUndo: true };

  it("maps navigation keys", () => {
    expect(keyAction("ArrowDown", ctx)).toEqual({ type: "move", delta: 1 });
    expect(keyAction("j", ctx)).toEqual({ type: "move", delta: 1 });
    expect(keyAction("ArrowUp", ctx)).toEqual({ type: "move", delta: -1 });
    expect(keyAction("K", ctx)).toEqual({ type: "move", delta: -1 });
    expect(keyAction("n", ctx)).toEqual({ type: "next-unreviewed" });
  });

  it("maps review keys to decisions", () => {
    expect(keyAction("a", ctx)).toEqual({ type: "review", state: "accepted" });
    expect(keyAction("R", ctx)).toEqual({ type: "review", state: "rejected" });
    expect(keyAction("v", ctx)).toEqual({ type: "review", state: "reviewed" });
    expect(keyAction("u", ctx)).toEqual({ type: "review", state: "unreviewed" });
  });

  it("ignores review keys when nothing is selected, but still navigates", () => {
    expect(keyAction("a", { ...ctx, hasSelection: false })).toBeNull();
    expect(keyAction("j", { ...ctx, hasSelection: false })).toEqual({ type: "move", delta: 1 });
  });

  it("undo only fires when there is something to undo", () => {
    expect(keyAction("z", ctx)).toEqual({ type: "undo" });
    expect(keyAction("z", { ...ctx, canUndo: false })).toBeNull();
  });

  it("does nothing while typing in a field", () => {
    for (const key of ["a", "j", "n", "z", "ArrowDown"]) {
      expect(keyAction(key, { ...ctx, typing: true })).toBeNull();
    }
  });

  it("does nothing with a modifier held, so ⌘A / ⌘Z keep their normal meaning", () => {
    for (const key of ["a", "z", "j"]) {
      expect(keyAction(key, { ...ctx, modifier: true })).toBeNull();
    }
  });

  it("ignores unrelated keys", () => {
    for (const key of ["Enter", "Escape", "x", "Tab", " "]) {
      expect(keyAction(key, ctx)).toBeNull();
    }
  });
});
