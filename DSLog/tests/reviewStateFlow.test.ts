import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";

describe("review state flow (simulated Figma runtime)", () => {
  it("update-change sets an individual change's reviewState, and bulk-update-review applies it to a batch", async () => {
    const { send } = await loadMainWithFakeFigma();

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
    if (created?.type !== "baseline-created") throw new Error("unreachable");

    const changeSetMessages = await send({ type: "get-state" });
    const stateMsg = changeSetMessages.find((m) => m.type === "state");
    if (stateMsg?.type !== "state") throw new Error("unreachable");
    const changeSet = stateMsg.project.changeSets.find((cs) => cs.baselineId === created.baseline.id);
    if (!changeSet || changeSet.changes.length < 2) throw new Error("unreachable — expected an initial all-added changeset");

    expect(changeSet.changes.every((c) => c.reviewState === "unreviewed")).toBe(true);

    const [first, second] = changeSet.changes;

    const updateMessages = await send({
      type: "update-change",
      changeSetId: changeSet.id,
      changeId: first!.id,
      reviewState: "accepted",
    });
    const afterUpdate = updateMessages.find((m) => m.type === "state");
    if (afterUpdate?.type !== "state") throw new Error("unreachable");
    const updatedChangeSet = afterUpdate.project.changeSets.find((cs) => cs.id === changeSet.id);
    expect(updatedChangeSet?.changes.find((c) => c.id === first!.id)?.reviewState).toBe("accepted");
    expect(updatedChangeSet?.changes.find((c) => c.id === second!.id)?.reviewState).toBe("unreviewed");

    const bulkMessages = await send({
      type: "bulk-update-review",
      changeSetId: changeSet.id,
      changeIds: [first!.id, second!.id],
      reviewState: "reviewed",
    });
    const afterBulk = bulkMessages.find((m) => m.type === "state");
    if (afterBulk?.type !== "state") throw new Error("unreachable");
    const bulkChangeSet = afterBulk.project.changeSets.find((cs) => cs.id === changeSet.id);
    expect(bulkChangeSet?.changes.find((c) => c.id === first!.id)?.reviewState).toBe("reviewed");
    expect(bulkChangeSet?.changes.find((c) => c.id === second!.id)?.reviewState).toBe("reviewed");
  });
});
