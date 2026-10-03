import { describe, expect, it } from "vitest";
import type { Change, ChangeSet } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";
import { carryOverReviews } from "@shared/utils/carryOverReviews";
import { foldConfirmedRename } from "@shared/utils/renames";
import { applyChangePatches } from "@shared/utils/changePatches";
import { createEmptyProject } from "@shared/types/project";

let counter = 0;
function change(overrides: Partial<Change> = {}): Change {
  counter++;
  return {
    id: `c${counter}`,
    entityType: "component",
    entityId: "button",
    entityName: "Button",
    category: "modified",
    severity: "minor",
    changeType: "padding-changed",
    summary: "Padding changed",
    field: "padding",
    before: 8,
    after: 12,
    breaking: false,
    potentialBreaking: false,
    reviewState: "unreviewed",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
const set = (id: string, changes: Change[]): ChangeSet => ({
  id, baselineId: "b1", createdAt: "2026-01-01", changes,
  scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
});
const tracked = (overrides: Partial<TrackedEntity> = {}): TrackedEntity => ({
  id: "button", kind: "component", displayName: "Button", deprecated: false, renameHistory: [], ...overrides,
});

describe("carryOverReviews: the same change again", () => {
  it("keeps the decision, notes and classification even though the new change has a fresh id", () => {
    const old = change({ reviewState: "accepted", reviewNote: "intentional", migrationNote: "none needed", manualClassification: { breaking: true, potentialBreaking: false, overriddenAt: "t" } });
    const fresh = change();
    const result = carryOverReviews(set("new", [fresh]), set("old", [old]), []);

    expect(fresh.id).not.toBe(old.id);
    expect(fresh).toMatchObject({ reviewState: "accepted", reviewNote: "intentional", migrationNote: "none needed" });
    expect(fresh.manualClassification).toEqual(old.manualClassification);
    expect(fresh.manualClassification).not.toBe(old.manualClassification); // a copy, not shared
    expect(fresh.changedSinceReview).toBeUndefined();
    expect(result).toEqual({ carried: 1, reset: 0 });
  });

  it("carries every kind of decision", () => {
    for (const state of ["reviewed", "accepted", "rejected"] as const) {
      const fresh = change();
      carryOverReviews(set("n", [fresh]), set("o", [change({ reviewState: state })]), []);
      expect(fresh.reviewState).toBe(state);
    }
  });

  it("leaves unreviewed changes unreviewed and does not count them", () => {
    const fresh = change();
    const result = carryOverReviews(set("n", [fresh]), set("o", [change()]), []);
    expect(fresh.reviewState).toBe("unreviewed");
    expect(result).toEqual({ carried: 0, reset: 0 });
  });

  it("keeps notes on a change that was never given a decision", () => {
    const fresh = change();
    carryOverReviews(set("n", [fresh]), set("o", [change({ reviewNote: "TODO check with design" })]), []);
    expect(fresh.reviewNote).toBe("TODO check with design");
  });

  it("carries a dismissed rename suggestion on both sides", () => {
    const added = change({ entityId: "new", changeType: "component-added", field: undefined, before: undefined, after: undefined, summary: "Added", renameResolution: undefined });
    const removed = change({ entityId: "old", changeType: "component-removed", field: undefined, before: undefined, after: undefined, summary: "Removed" });
    const oldAdded = { ...added, id: "oa", renameResolution: "dismissed" as const };
    const oldRemoved = { ...removed, id: "or", renameResolution: "dismissed" as const };
    carryOverReviews(set("n", [added, removed]), set("o", [oldAdded, oldRemoved]), []);
    expect(added.renameResolution).toBe("dismissed");
    expect(removed.renameResolution).toBe("dismissed");
  });
});

describe("carryOverReviews: the same kind of change with different values", () => {
  it("resets the decision, flags the change, and keeps the user's notes", () => {
    const old = change({ reviewState: "accepted", reviewNote: "fine at 12", after: 12 });
    const fresh = change({ after: 20, summary: "Padding changed 8 → 20" });
    const result = carryOverReviews(set("n", [fresh]), set("o", [old]), []);

    expect(fresh.reviewState).toBe("unreviewed");
    expect(fresh.changedSinceReview).toBe(true);
    expect(fresh.reviewNote).toBe("fine at 12");
    expect(result).toEqual({ carried: 0, reset: 1 });
  });

  it("does not flag a change that was never reviewed", () => {
    const fresh = change({ after: 20 });
    const result = carryOverReviews(set("n", [fresh]), set("o", [change({ after: 12 })]), []);
    expect(fresh.changedSinceReview).toBeUndefined();
    expect(result.reset).toBe(0);
  });

  it("keeps the flag while it still waits for a fresh decision", () => {
    const old = change({ changedSinceReview: true, after: 20 });
    const same = change({ after: 20 });
    carryOverReviews(set("n", [same]), set("o", [old]), []);
    expect(same.changedSinceReview).toBe(true);

    const moved = change({ after: 30 });
    carryOverReviews(set("n2", [moved]), set("o2", [old]), []);
    expect(moved.changedSinceReview).toBe(true);
  });

  it("a fresh decision clears the flag", () => {
    const project = { ...createEmptyProject(2), changeSets: [set("cs", [change({ id: "x", changedSinceReview: true })])] };
    const next = applyChangePatches(project, "cs", [{ changeId: "x", reviewState: "accepted" }]);
    expect(next.changeSets[0]!.changes[0]!.changedSinceReview).toBeUndefined();
  });

  it("editing only a note does not clear the flag", () => {
    const project = { ...createEmptyProject(2), changeSets: [set("cs", [change({ id: "x", changedSinceReview: true })])] };
    const next = applyChangePatches(project, "cs", [{ changeId: "x", reviewNote: "looking" }]);
    expect(next.changeSets[0]!.changes[0]!.changedSinceReview).toBe(true);
  });
});

describe("carryOverReviews: matching rules", () => {
  it("different entities, change types and fields never borrow each other's decisions", () => {
    const old = change({ reviewState: "accepted" });
    for (const other of [
      change({ entityId: "card" }),
      change({ changeType: "radius-changed" }),
      change({ field: "margin" }),
      change({ entityType: "token" }),
    ]) {
      carryOverReviews(set("n", [other]), set("o", [old]), []);
      expect(other.reviewState).toBe("unreviewed");
    }
  });

  it("changes with no earlier counterpart start unreviewed; changes that went away are simply gone", () => {
    const kept = change({ entityId: "a", reviewState: "accepted" });
    const gone = change({ entityId: "b", reviewState: "rejected" });
    const fresh = change({ entityId: "a" });
    const brandNew = change({ entityId: "c" });
    const next = set("n", [fresh, brandNew]);
    carryOverReviews(next, set("o", [kept, gone]), []);
    expect(next.changes.map((c) => [c.entityId, c.reviewState])).toEqual([["a", "accepted"], ["c", "unreviewed"]]);
  });

  it("pairs several changes of one kind by their content, in any order", () => {
    const olds = [
      change({ changeType: "variant-added", field: undefined, summary: "Added variant Small", reviewState: "accepted", reviewNote: "small" }),
      change({ changeType: "variant-added", field: undefined, summary: "Added variant Large", reviewState: "rejected", reviewNote: "large" }),
    ];
    const large = change({ changeType: "variant-added", field: undefined, summary: "Added variant Large" });
    const small = change({ changeType: "variant-added", field: undefined, summary: "Added variant Small" });
    carryOverReviews(set("n", [large, small]), set("o", olds), []);
    expect(large).toMatchObject({ reviewState: "rejected", reviewNote: "large" });
    expect(small).toMatchObject({ reviewState: "accepted", reviewNote: "small" });
  });

  it("does not guess between several candidates when the leftovers don't line up", () => {
    const old1 = change({ changeType: "variant-added", field: undefined, summary: "Added variant A", reviewState: "accepted" });
    const old2 = change({ changeType: "variant-added", field: undefined, summary: "Added variant B", reviewState: "accepted" });
    const fresh = change({ changeType: "variant-added", field: undefined, summary: "Added variant C" });
    carryOverReviews(set("n", [fresh]), set("o", [old1, old2]), []);
    expect(fresh.reviewState).toBe("unreviewed");
    expect(fresh.changedSinceReview).toBeUndefined();
  });

  it("compares token mode details as part of the content", () => {
    const modes = (after: number) => [{ modeName: "Light", before: 1, after, changed: true }];
    const old = change({ entityType: "token", changeType: "token-value-changed", modeDetails: modes(2), reviewState: "accepted" });
    const same = change({ entityType: "token", changeType: "token-value-changed", modeDetails: modes(2) });
    const moved = change({ entityType: "token", changeType: "token-value-changed", modeDetails: modes(9) });
    carryOverReviews(set("n", [same]), set("o", [old]), []);
    carryOverReviews(set("n2", [moved]), set("o2", [old]), []);
    expect(same.reviewState).toBe("accepted");
    expect(moved.reviewState).toBe("unreviewed");
    expect(moved.changedSinceReview).toBe(true);
  });

  it("with no previous change set it changes nothing", () => {
    const fresh = change();
    expect(carryOverReviews(set("n", [fresh]), undefined, [])).toEqual({ carried: 0, reset: 0 });
    expect(fresh.reviewState).toBe("unreviewed");
  });

  it("never touches the previous change set", () => {
    const old = set("o", [change({ reviewState: "accepted", reviewNote: "x" })]);
    const before = JSON.stringify(old);
    carryOverReviews(set("n", [change({ after: 99 })]), old, []);
    expect(JSON.stringify(old)).toBe(before);
  });
});

describe("carryOverReviews: renames", () => {
  const pair = () => {
    const removed = change({ entityId: "old", entityName: "Old", changeType: "component-removed", field: undefined, before: undefined, after: undefined, summary: "Removed Old" });
    const added = change({ entityId: "new", entityName: "New", changeType: "component-added", field: undefined, before: undefined, after: undefined, summary: "Added New", possibleRenameOf: removed.id });
    return { removed, added };
  };
  const renameHistory = (entries: Array<[string, string]>) =>
    entries.map(([fromId, toId]) => ({ fromId, fromName: fromId, toId, toName: toId, confirmedAt: "t" }));

  it("re-applies a confirmed rename instead of showing the old suggestion again", () => {
    const { removed, added } = pair();
    const next = set("n", [removed, added]);
    carryOverReviews(next, undefined, [tracked({ id: "new", renameHistory: renameHistory([["old", "new"]]) })]);

    expect(next.changes).toHaveLength(1);
    expect(next.changes[0]).toMatchObject({ changeType: "component-renamed", renameResolution: "confirmed", summary: 'Renamed from "Old" to "New" (id changed)' });
  });

  it("carries the review of the renamed change across the re-scan", () => {
    const first = pair();
    const prev = set("o", [first.removed, first.added]);
    foldConfirmedRename(prev, first.added, first.removed);
    first.added.reviewState = "accepted";
    first.added.reviewNote = "renamed on purpose";

    const second = pair();
    const next = set("n", [second.removed, second.added]);
    const result = carryOverReviews(next, prev, [tracked({ id: "new", renameHistory: renameHistory([["old", "new"]]) })]);

    expect(next.changes).toHaveLength(1);
    expect(next.changes[0]).toMatchObject({ changeType: "component-renamed", reviewState: "accepted", reviewNote: "renamed on purpose" });
    expect(result.carried).toBe(1);
  });

  it("follows a chain of renames end to end (A → B → C)", () => {
    const removed = change({ entityId: "A", changeType: "component-removed", field: undefined, summary: "Removed A" });
    const added = change({ entityId: "C", changeType: "component-added", field: undefined, summary: "Added C", possibleRenameOf: removed.id });
    const next = set("n", [removed, added]);
    carryOverReviews(next, undefined, [tracked({ id: "C", renameHistory: renameHistory([["A", "B"], ["B", "C"]]) })]);
    expect(next.changes.map((c) => c.changeType)).toEqual(["component-renamed"]);
  });

  it("leaves an unconfirmed suggestion alone", () => {
    const { removed, added } = pair();
    const next = set("n", [removed, added]);
    carryOverReviews(next, undefined, [tracked({ id: "unrelated", renameHistory: renameHistory([["x", "y"]]) })]);
    expect(next.changes).toHaveLength(2);
    expect(added.renameResolution).toBeUndefined();
  });

  it("does not fold a pair the user already dismissed", () => {
    const { removed, added } = pair();
    added.renameResolution = "dismissed";
    const next = set("n", [removed, added]);
    carryOverReviews(next, undefined, [tracked({ id: "new", renameHistory: renameHistory([["old", "new"]]) })]);
    expect(next.changes).toHaveLength(2);
  });
});

describe("carryOverReviews: manual deprecations", () => {
  const deprecation = (overrides: Partial<Change> = {}) =>
    change({ category: "deprecated", changeType: "component-deprecated", field: undefined, before: undefined, after: undefined, summary: "Marked deprecated", reviewState: "reviewed", ...overrides });

  it("carries them over while the entity is still deprecated", () => {
    const old = deprecation();
    const next = set("n", [change({ entityId: "card" })]);
    const result = carryOverReviews(next, set("o", [old]), [tracked({ deprecated: true })]);
    expect(next.changes.map((c) => c.changeType)).toEqual(["padding-changed", "component-deprecated"]);
    expect(next.changes[1]!.reviewState).toBe("reviewed");
    expect(result.carried).toBe(1);
  });

  it("drops them once the entity is no longer deprecated", () => {
    const next = set("n", []);
    carryOverReviews(next, set("o", [deprecation()]), [tracked({ deprecated: false })]);
    expect(next.changes).toEqual([]);
  });

  it("drops them when nothing tracks the entity", () => {
    const next = set("n", []);
    carryOverReviews(next, set("o", [deprecation()]), []);
    expect(next.changes).toEqual([]);
  });

  it("does not duplicate one the new diff already contains", () => {
    const next = set("n", [deprecation({ reviewState: "unreviewed" })]);
    carryOverReviews(next, set("o", [deprecation()]), [tracked({ deprecated: true })]);
    expect(next.changes).toHaveLength(1);
    expect(next.changes[0]!.reviewState).toBe("reviewed");
  });
});
