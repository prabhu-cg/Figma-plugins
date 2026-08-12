import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";

describe("compare-releases flow (simulated Figma runtime)", () => {
  it("diffs two historical releases' snapshots and returns the result without persisting a new changeSet", async () => {
    const { send, components, componentSet } = await loadMainWithFakeFigma();

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
    const baselineCreated = baselineMessages.find((m) => m.type === "baseline-created");
    if (baselineCreated?.type !== "baseline-created") throw new Error("unreachable");

    const releaseAMessages = await send({
      type: "create-release",
      version: "1.0.0",
      title: "Initial",
      include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
    });
    const releaseA = releaseAMessages.find((m) => m.type === "release-created");
    if (releaseA?.type !== "release-created") throw new Error("unreachable");

    // Remove a variant, then cut a second release capturing that change.
    componentSet.children = (componentSet.children ?? []).slice(0, 2);
    const releaseBMessages = await send({
      type: "create-release",
      version: "1.1.0",
      title: "Badge update",
      include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
    });
    const releaseB = releaseBMessages.find((m) => m.type === "release-created");
    if (releaseB?.type !== "release-created") throw new Error("unreachable");

    const stateBefore = (await send({ type: "get-state" })).find((m) => m.type === "state");
    if (stateBefore?.type !== "state") throw new Error("unreachable");
    const changeSetCountBefore = stateBefore.project.changeSets.length;

    const compareMessages = await send({
      type: "compare-releases",
      releaseIdA: releaseA.release.id,
      releaseIdB: releaseB.release.id,
    });
    const result = compareMessages.find((m) => m.type === "release-comparison-result");
    expect(result?.type).toBe("release-comparison-result");
    if (result?.type !== "release-comparison-result") throw new Error("unreachable");
    expect(result.changeSet.changes.some((c) => c.changeType === "variant-removed")).toBe(true);

    const stateAfter = (await send({ type: "get-state" })).find((m) => m.type === "state");
    if (stateAfter?.type !== "state") throw new Error("unreachable");
    expect(stateAfter.project.changeSets.length).toBe(changeSetCountBefore);

    expect(components.length).toBeGreaterThan(0); // sanity: fixture still intact
  });

  it("errors gracefully when a release id doesn't resolve to a stored baseline", async () => {
    const { send } = await loadMainWithFakeFigma();
    const messages = await send({ type: "compare-releases", releaseIdA: "nope-a", releaseIdB: "nope-b" });
    expect(messages.some((m) => m.type === "error")).toBe(true);
  });
});
