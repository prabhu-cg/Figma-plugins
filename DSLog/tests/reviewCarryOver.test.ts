import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";
import type { Change } from "@shared/types/change";
import type { PluginToUiMessage } from "@shared/types/messages";
import type { Project } from "@shared/types/project";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Env = Awaited<ReturnType<typeof loadMainWithFakeFigma>>;
const include = { components: true, tokens: true, breakingChanges: true, migrationNotes: true };

async function stateOf(send: Env["send"]): Promise<Project> {
  const state = (await send({ type: "get-state" })).find((m) => m.type === "state");
  if (state?.type !== "state") throw new Error("no state");
  return JSON.parse(JSON.stringify(state.project));
}

async function createBaseline(send: Env["send"]) {
  const d = await send({ type: "discover-components", scope: "document", pageIds: [] });
  const dm = d.find((m) => m.type === "discovered-components");
  const ids = dm?.type === "discovered-components" ? dm.components.map((c) => c.id) : [];
  const msgs = await send({
    type: "create-baseline", name: "DS", version: "1.0.0",
    tracking: { components: { scope: "document", includedIds: ids, pageIds: [] }, tokens: { enabled: true, includedCollectionIds: [] } },
  });
  const created = msgs.find((m) => m.type === "baseline-created");
  if (created?.type !== "baseline-created") throw new Error("no baseline");
  return created.baseline;
}

async function scan(send: Env["send"]) {
  const msgs = await send({ type: "scan" });
  const done = msgs.find((m) => m.type === "scan-complete");
  if (done?.type !== "scan-complete") throw new Error("no scan-complete: " + JSON.stringify(msgs.map((m) => m.type)));
  return done;
}

const find = (changes: Change[], entityName: string, typePart: string) =>
  changes.find((c) => c.entityName === entityName && c.changeType.includes(typePart));

async function review(send: Env["send"], changeSetId: string, change: Change, fields: Record<string, unknown>) {
  await send({ type: "update-change", changeSetId, changeId: change.id, ...fields } as any);
}

describe("reviews survive a re-scan", () => {
  it("keeps the decision and notes on a change that is still there, under a new id", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    const first = await scan(send);
    const radius = find(first.changeSet.changes, "Component 1", "corner")!;
    await review(send, first.changeSet.id, radius, { reviewState: "accepted", reviewNote: "rounder is on brand", migrationNote: "none" });

    const second = await scan(send);
    const again = find(second.changeSet.changes, "Component 1", "corner")!;
    expect(again.id).not.toBe(radius.id);
    expect(second.changeSet.id).not.toBe(first.changeSet.id);
    expect(again).toMatchObject({ reviewState: "accepted", reviewNote: "rounder is on brand", migrationNote: "none" });
    expect(again.changedSinceReview).toBeUndefined();
    expect(second.reviewsKept).toBe(1);
    expect(second.reviewsReset).toBe(0);

    // ...and it is what the plugin now holds and has saved.
    const state = await stateOf(send);
    expect(state.changeSets).toHaveLength(1);
    expect(find(state.changeSets[0]!.changes, "Component 1", "corner")!.reviewState).toBe("accepted");
    await new Promise((r) => setTimeout(r, 30));
    const { loadProject } = await import("@plugin/storage");
    const stored = await loadProject();
    expect(find(stored.changeSets[0]!.changes, "Component 1", "corner")).toMatchObject({ reviewState: "accepted", reviewNote: "rounder is on brand" });
  });

  it("many rescans in a row keep everything", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    nodeMap.get("comp-2")!.cornerRadius = 9;
    const first = await scan(send);
    for (const c of first.changeSet.changes) await review(send, first.changeSet.id, c, { reviewState: "rejected" });

    let last = first;
    for (let i = 0; i < 4; i++) last = await scan(send);
    expect(last.changeSet.changes.length).toBe(first.changeSet.changes.length);
    expect(last.changeSet.changes.every((c) => c.reviewState === "rejected")).toBe(true);
  });

  it("resets a decision when the same change comes back with different values, flags it, and keeps the note", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    const first = await scan(send);
    const radius = find(first.changeSet.changes, "Component 1", "corner")!;
    await review(send, first.changeSet.id, radius, { reviewState: "accepted", reviewNote: "fine at 12" });

    nodeMap.get("comp-1")!.cornerRadius = 20;
    const second = await scan(send);
    const moved = find(second.changeSet.changes, "Component 1", "corner")!;
    expect(moved).toMatchObject({ reviewState: "unreviewed", changedSinceReview: true, reviewNote: "fine at 12" });
    expect(second.reviewsKept).toBe(0);
    expect(second.reviewsReset).toBe(1);

    // Deciding again clears the flag, and that sticks through the next scan.
    await review(send, second.changeSet.id, moved, { reviewState: "accepted" });
    const decided = find((await stateOf(send)).changeSets[0]!.changes, "Component 1", "corner")!;
    expect(decided.changedSinceReview).toBeUndefined();
    const third = await scan(send);
    expect(find(third.changeSet.changes, "Component 1", "corner")).toMatchObject({ reviewState: "accepted" });
  });

  it("drops a change that was undone, and a brand-new change starts unreviewed", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    const original = nodeMap.get("comp-1")!.cornerRadius;
    nodeMap.get("comp-1")!.cornerRadius = 12;
    const first = await scan(send);
    await review(send, first.changeSet.id, find(first.changeSet.changes, "Component 1", "corner")!, { reviewState: "accepted" });

    nodeMap.get("comp-1")!.cornerRadius = original; // undo it
    nodeMap.get("comp-2")!.cornerRadius = 7; // and change something else
    const second = await scan(send);
    expect(find(second.changeSet.changes, "Component 1", "corner")).toBeUndefined();
    expect(find(second.changeSet.changes, "Component 2", "corner")).toMatchObject({ reviewState: "unreviewed" });
  });

  it("keeps a manual classification override", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    const first = await scan(send);
    const radius = find(first.changeSet.changes, "Component 1", "corner")!;
    expect(radius.breaking).toBe(false);
    const override = { breaking: true, potentialBreaking: false, overriddenAt: "2026-01-01T00:00:00.000Z" };
    await review(send, first.changeSet.id, radius, { manualClassification: override });

    const second = await scan(send);
    expect(find(second.changeSet.changes, "Component 1", "corner")!.manualClassification).toEqual(override);
  });
});

describe("releases keep the review work", () => {
  async function removeComponentAndReview(env: Env) {
    const { send, page } = env;
    await createBaseline(send);
    (page.children as any[]).splice(3, 1); // delete a component: a breaking change
    const first = await scan(send);
    const removed = first.changeSet.changes.find((c) => c.changeType === "component-removed")!;
    await review(send, first.changeSet.id, removed, { reviewState: "accepted", reviewNote: "retired", migrationNote: "USE THE NEW BUTTON INSTEAD" });
    return removed;
  }

  it("the changelog contains the migration notes typed during review", async () => {
    const env = await loadMainWithFakeFigma();
    await removeComponentAndReview(env);
    const msgs = await env.send({ type: "create-release", version: "2.0.0", title: "Cleanup", include });
    const created = msgs.find((m) => m.type === "release-created");
    if (created?.type !== "release-created") throw new Error("no release");
    expect(created.release.changelogMarkdown).toContain("USE THE NEW BUTTON INSTEAD");
    expect(created.release.changelogJson).toContain("USE THE NEW BUTTON INSTEAD");
  });

  it("the release's own record holds the decisions, notes and states", async () => {
    const env = await loadMainWithFakeFigma();
    await removeComponentAndReview(env);
    await env.send({ type: "create-release", version: "2.0.0", title: "Cleanup", include });

    const state = await stateOf(env.send);
    const recorded = state.changeSets.find((cs) => cs.id === state.releases[0]!.changeSetId)!;
    const removed = recorded.changes.find((c) => c.changeType === "component-removed")!;
    expect(removed).toMatchObject({ reviewState: "accepted", reviewNote: "retired", migrationNote: "USE THE NEW BUTTON INSTEAD" });
  });

  it("the migration actions card and release checks see the same notes the changelog does", async () => {
    const env = await loadMainWithFakeFigma();
    await removeComponentAndReview(env);
    const { buildMigrationReport } = await import("@shared/utils/migrationReport");
    const before = await stateOf(env.send);
    const live = before.changeSets[0]!;
    expect(buildMigrationReport(live.changes, before.trackedEntities).map((i) => i.note)).toContain("USE THE NEW BUTTON INSTEAD");

    await env.send({ type: "create-release", version: "2.0.0", title: "Cleanup", include });
    const after = await stateOf(env.send);
    const record = after.changeSets.find((cs) => cs.id === after.releases[0]!.changeSetId)!;
    expect(buildMigrationReport(record.changes, after.trackedEntities).map((i) => i.note)).toContain("USE THE NEW BUTTON INSTEAD");
  });
});

describe("rename decisions survive a re-scan", () => {
  async function recreateAsRenamed(env: Env) {
    const { send, page, nodeMap } = env;
    const baseline = await createBaseline(send);
    const original = baseline.snapshot.components.find((c) => c.identity.name === "Component 1")!;
    const oldNode = nodeMap.get(original.identity.id)!;
    page.children = (page.children ?? []).filter((c) => c.id !== original.identity.id);
    nodeMap.delete(original.identity.id);
    const recreated = { ...oldNode, id: "comp-1-recreated", name: "Component 1 Renamed", key: oldNode.key };
    nodeMap.set(recreated.id, recreated);
    page.children = [...(page.children ?? []), recreated];
    recreated.parent = page;
    const first = await scan(send);
    return {
      first,
      removed: first.changeSet.changes.find((c) => c.changeType === "component-removed")!,
      added: first.changeSet.changes.find((c) => c.changeType === "component-added" && c.entityId === recreated.id)!,
    };
  }

  it("a dismissed suggestion stays dismissed", async () => {
    const env = await loadMainWithFakeFigma();
    const { first, removed, added } = await recreateAsRenamed(env);
    await env.send({ type: "dismiss-rename", changeSetId: first.changeSet.id, addedChangeId: added.id, removedChangeId: removed.id });

    const second = await scan(env.send);
    const addedAgain = second.changeSet.changes.find((c) => c.changeType === "component-added" && c.entityId === added.entityId)!;
    const removedAgain = second.changeSet.changes.find((c) => c.changeType === "component-removed" && c.entityId === removed.entityId)!;
    expect(addedAgain.possibleRenameOf).toBe(removedAgain.id); // still detected as a pair...
    expect(addedAgain.renameResolution).toBe("dismissed"); // ...but not asked about again
    expect(removedAgain.renameResolution).toBe("dismissed");
  });

  it("a confirmed rename is still one 'renamed' change, with its review", async () => {
    const env = await loadMainWithFakeFigma();
    const { first, removed, added } = await recreateAsRenamed(env);
    await env.send({ type: "confirm-rename", changeSetId: first.changeSet.id, addedChangeId: added.id, removedChangeId: removed.id });
    await review(env.send, first.changeSet.id, added, { reviewState: "accepted", reviewNote: "renamed on purpose" });

    const second = await scan(env.send);
    const renamed = second.changeSet.changes.filter((c) => c.changeType === "component-renamed");
    expect(renamed).toHaveLength(1);
    expect(renamed[0]).toMatchObject({ entityId: added.entityId, renameResolution: "confirmed", reviewState: "accepted", reviewNote: "renamed on purpose" });
    expect(second.changeSet.changes.some((c) => c.changeType === "component-removed" && c.entityId === removed.entityId)).toBe(false);
    expect(second.changeSet.changes.some((c) => c.changeType === "component-added" && c.entityId === added.entityId)).toBe(false);
  });
});

describe("manual deprecations survive a re-scan", () => {
  it("stay listed while the component is deprecated, and go when it is not", async () => {
    const env = await loadMainWithFakeFigma();
    const baseline = await createBaseline(env.send);
    const target = baseline.snapshot.components[0]!;
    await env.send({ type: "mark-deprecated", entityId: target.identity.id, kind: "component", displayName: target.identity.name, replacement: "Other" });

    const second = await scan(env.send);
    expect(second.changeSet.changes.filter((c) => c.changeType === "component-deprecated")).toHaveLength(1);

    await env.send({ type: "unmark-deprecated", entityId: target.identity.id });
    const third = await scan(env.send);
    expect(third.changeSet.changes.some((c) => c.changeType === "component-deprecated")).toBe(false);
  });
});

describe("the toast on scan completion", () => {
  it("reports how many decisions were kept and how many need another look", async () => {
    const env = await loadMainWithFakeFigma();
    await createBaseline(env.send);
    env.nodeMap.get("comp-1")!.cornerRadius = 12;
    env.nodeMap.get("comp-2")!.cornerRadius = 9;
    const first = await scan(env.send);
    for (const c of first.changeSet.changes) await review(env.send, first.changeSet.id, c, { reviewState: "accepted" });

    env.nodeMap.get("comp-2")!.cornerRadius = 30; // one of the two moves on
    const second = await scan(env.send);
    expect(second.reviewsKept).toBe(1);
    expect(second.reviewsReset).toBe(1);
  });
});

void (undefined as unknown as PluginToUiMessage);
