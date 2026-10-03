import { describe, expect, it } from "vitest";
import type { Change, ChangeSet } from "@shared/types/change";
import { createEmptyProject, type Project, type Release } from "@shared/types/project";
import { applyChangePatches } from "@shared/utils/changePatches";
import { pruneStaleChangeSets } from "@shared/utils/changeSets";

function change(id: string, overrides: Partial<Change> = {}): Change {
  return {
    id, entityType: "component", entityId: `e-${id}`, entityName: id, category: "modified", severity: "minor",
    changeType: "x", summary: id, breaking: false, potentialBreaking: false, reviewState: "unreviewed",
    createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
  };
}
function changeSet(id: string, baselineId: string, createdAt: string, changes: Change[] = []): ChangeSet {
  return { id, baselineId, createdAt, changes, scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] } };
}
function project(sets: ChangeSet[], extra: Partial<Project> = {}): Project {
  return { ...createEmptyProject(2), currentBaselineId: "b2", changeSets: sets, ...extra };
}
const release = (changeSetId: string): Release =>
  ({ id: `r-${changeSetId}`, version: "1.0.0", title: "t", baselineId: "b", changeSetId, include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true }, changelogMarkdown: "", changelogJson: "", createdAt: "x" });

describe("applyChangePatches", () => {
  const base = project([changeSet("cs", "b2", "2026-01-02", [change("a"), change("b"), change("c")])]);

  it("applies review fields to just the patched changes", () => {
    const next = applyChangePatches(base, "cs", [
      { changeId: "a", reviewState: "accepted" },
      { changeId: "c", reviewNote: "note", migrationNote: "migrate" },
    ]);
    const [a, b, c] = next.changeSets[0]!.changes;
    expect(a!.reviewState).toBe("accepted");
    expect(b!.reviewState).toBe("unreviewed");
    expect(c).toMatchObject({ reviewNote: "note", migrationNote: "migrate", reviewState: "unreviewed" });
  });

  it("never mutates its input", () => {
    const before = JSON.stringify(base);
    applyChangePatches(base, "cs", [{ changeId: "a", reviewState: "rejected" }]);
    expect(JSON.stringify(base)).toBe(before);
  });

  it("keeps the identity of everything it did not touch", () => {
    const next = applyChangePatches(base, "cs", [{ changeId: "b", reviewState: "reviewed" }]);
    const [a, b, c] = next.changeSets[0]!.changes;
    expect(a).toBe(base.changeSets[0]!.changes[0]);
    expect(c).toBe(base.changeSets[0]!.changes[2]);
    expect(b).not.toBe(base.changeSets[0]!.changes[1]);
    expect(next.baselines).toBe(base.baselines);
    expect(next.releases).toBe(base.releases);
  });

  it("sets and clears a manual classification (null clears)", () => {
    const override = { breaking: true, potentialBreaking: false, overriddenAt: "now" };
    const set = applyChangePatches(base, "cs", [{ changeId: "a", manualClassification: override }]);
    expect(set.changeSets[0]!.changes[0]!.manualClassification).toEqual(override);
    const cleared = applyChangePatches(set, "cs", [{ changeId: "a", manualClassification: null }]);
    expect(cleared.changeSets[0]!.changes[0]!.manualClassification).toBeUndefined();
  });

  it("leaves fields alone when the patch does not mention them", () => {
    const withNote = applyChangePatches(base, "cs", [{ changeId: "a", reviewNote: "keep me" }]);
    const next = applyChangePatches(withNote, "cs", [{ changeId: "a", reviewState: "accepted" }]);
    expect(next.changeSets[0]!.changes[0]).toMatchObject({ reviewNote: "keep me", reviewState: "accepted" });
  });

  it("returns the same project when nothing matches", () => {
    expect(applyChangePatches(base, "cs", [])).toBe(base);
    expect(applyChangePatches(base, "cs", [{ changeId: "nope", reviewState: "accepted" }])).toBe(base);
    expect(applyChangePatches(base, "other", [{ changeId: "a", reviewState: "accepted" }])).toBe(base);
  });

  it("only touches the named change set", () => {
    const two = project([changeSet("cs1", "b1", "1", [change("a")]), changeSet("cs2", "b2", "2", [change("a")])]);
    const next = applyChangePatches(two, "cs2", [{ changeId: "a", reviewState: "accepted" }]);
    expect(next.changeSets[0]).toBe(two.changeSets[0]);
    expect(next.changeSets[1]!.changes[0]!.reviewState).toBe("accepted");
  });
});

describe("pruneStaleChangeSets", () => {
  it("keeps only the newest set for the current baseline", () => {
    const p = project([
      changeSet("old1", "b2", "2026-01-01"),
      changeSet("newest", "b2", "2026-01-03"),
      changeSet("old2", "b2", "2026-01-02"),
    ]);
    expect(pruneStaleChangeSets(p).changeSets.map((cs) => cs.id)).toEqual(["newest"]);
  });

  it("keeps every set a release points at, even for older baselines", () => {
    const p = project(
      [changeSet("rel1", "b1", "2026-01-01"), changeSet("scan-old-b1", "b1", "2026-01-02"), changeSet("rel2", "b2", "2026-01-03"), changeSet("cur", "b2", "2026-01-04")],
      { releases: [release("rel1"), release("rel2")] },
    );
    expect(pruneStaleChangeSets(p).changeSets.map((cs) => cs.id)).toEqual(["rel1", "rel2", "cur"]);
  });

  it("drops stale scans of superseded baselines", () => {
    const p = project([changeSet("b1-scan", "b1", "2026-01-01"), changeSet("cur", "b2", "2026-01-02")]);
    expect(pruneStaleChangeSets(p).changeSets.map((cs) => cs.id)).toEqual(["cur"]);
  });

  it("returns the same project when there is nothing to drop", () => {
    const p = project([changeSet("cur", "b2", "2026-01-02")]);
    expect(pruneStaleChangeSets(p)).toBe(p);
  });

  it("with no current baseline, keeps only release records", () => {
    const p = project([changeSet("rel", "b1", "1"), changeSet("scan", "b1", "2")], { currentBaselineId: undefined, releases: [release("rel")] });
    expect(pruneStaleChangeSets(p).changeSets.map((cs) => cs.id)).toEqual(["rel"]);
  });

  it("never modifies the input", () => {
    const p = project([changeSet("a", "b2", "1"), changeSet("b", "b2", "2")]);
    const before = JSON.stringify(p);
    pruneStaleChangeSets(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
