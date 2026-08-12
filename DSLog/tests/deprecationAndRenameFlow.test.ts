import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";
import type { Change } from "@shared/types/change";

async function createBaseline(send: Awaited<ReturnType<typeof loadMainWithFakeFigma>>["send"]) {
  const discovered = await send({ type: "discover-components", scope: "document", pageIds: [] });
  const discoveredMsg = discovered.find((m) => m.type === "discovered-components");
  const componentIds =
    discoveredMsg?.type === "discovered-components" ? discoveredMsg.components.map((c) => c.id) : [];

  const baselineMessages = await send({
    type: "create-baseline",
    name: "Design System",
    version: "1.0.0",
    tracking: {
      components: { scope: "document", includedIds: componentIds, pageIds: [] },
      tokens: { enabled: true, includedCollectionIds: [] },
    },
  });
  const created = baselineMessages.find((m) => m.type === "baseline-created");
  if (created?.type !== "baseline-created") throw new Error("baseline not created");
  return created.baseline;
}

describe("deprecation flow (simulated Figma runtime)", () => {
  it("marking an entity deprecated upserts a TrackedEntity and synthesizes a deprecated Change", async () => {
    const { send } = await loadMainWithFakeFigma();
    const baseline = await createBaseline(send);
    const targetComponent = baseline.snapshot.components[0];
    if (!targetComponent) throw new Error("unreachable");

    const markMessages = await send({
      type: "mark-deprecated",
      entityId: targetComponent.identity.id,
      kind: "component",
      displayName: targetComponent.identity.name,
      replacement: "Button / XL",
      migrationNote: "Replace Size=Large with Size=XL.",
    });
    const state = markMessages.find((m) => m.type === "state");
    if (state?.type !== "state") throw new Error("unreachable");

    const tracked = state.project.trackedEntities.find((e) => e.id === targetComponent.identity.id);
    expect(tracked?.deprecated).toBe(true);
    expect(tracked?.replacement).toBe("Button / XL");

    const changeSet = state.project.changeSets.find((cs) => cs.baselineId === baseline.id);
    const deprecatedChange = changeSet?.changes.find((c: Change) => c.category === "deprecated");
    expect(deprecatedChange).toBeDefined();
    expect(deprecatedChange?.entityId).toBe(targetComponent.identity.id);

    const unmarkMessages = await send({ type: "unmark-deprecated", entityId: targetComponent.identity.id });
    const unmarkState = unmarkMessages.find((m) => m.type === "state");
    if (unmarkState?.type !== "state") throw new Error("unreachable");
    expect(unmarkState.project.trackedEntities.find((e) => e.id === targetComponent.identity.id)?.deprecated).toBe(
      false,
    );
  });
});

describe("rename confirmation flow (simulated Figma runtime)", () => {
  it("a component deleted and recreated under a new id surfaces as a rename suggestion, and confirm-rename folds it into one change while recording rename history", async () => {
    const { send, page, nodeMap } = await loadMainWithFakeFigma();
    const baseline = await createBaseline(send);
    const original = baseline.snapshot.components.find((c) => c.identity.name === "Component 1");
    if (!original) throw new Error("unreachable");

    // Simulate delete + recreate under the same component key (same visual
    // content, new node id) — the real-world "rename via replace" case that
    // a plain node-id-based diff can't see as anything but remove+add.
    const oldNode = nodeMap.get(original.identity.id);
    if (!oldNode) throw new Error("unreachable");
    page.children = (page.children ?? []).filter((c) => c.id !== original.identity.id);
    nodeMap.delete(original.identity.id);

    const recreated = {
      ...oldNode,
      id: "comp-1-recreated",
      name: "Component 1 Renamed",
      key: oldNode.key, // same component key survives the recreate
    };
    nodeMap.set(recreated.id, recreated);
    page.children = [...(page.children ?? []), recreated];
    recreated.parent = page;

    const scanMessages = await send({ type: "scan" });
    const scanComplete = scanMessages.find((m) => m.type === "scan-complete");
    if (scanComplete?.type !== "scan-complete") throw new Error("unreachable");

    const removed = scanComplete.changeSet.changes.find((c) => c.changeType === "component-removed");
    const added = scanComplete.changeSet.changes.find((c) => c.changeType === "component-added");
    expect(removed).toBeDefined();
    expect(added).toBeDefined();
    expect(added?.possibleRenameOf).toBe(removed?.id);

    const confirmMessages = await send({
      type: "confirm-rename",
      changeSetId: scanComplete.changeSet.id,
      addedChangeId: added!.id,
      removedChangeId: removed!.id,
    });
    const confirmedState = confirmMessages.find((m) => m.type === "state");
    if (confirmedState?.type !== "state") throw new Error("unreachable");

    const confirmedChangeSet = confirmedState.project.changeSets.find((cs) => cs.id === scanComplete.changeSet.id);
    expect(confirmedChangeSet?.changes.some((c) => c.id === removed!.id)).toBe(false);
    const renamedChange = confirmedChangeSet?.changes.find((c) => c.id === added!.id);
    expect(renamedChange?.changeType).toBe("component-renamed");

    const trackedEntity = confirmedState.project.trackedEntities.find((e) => e.id === recreated.id);
    expect(trackedEntity?.renameHistory).toHaveLength(1);
    expect(trackedEntity?.renameHistory[0]).toMatchObject({
      fromId: original.identity.id,
      toId: recreated.id,
    });
  });
});
