import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";

/**
 * Simulates the full baseline -> scan -> release flow through main.ts
 * against a fake `figma` global, without a real Figma runtime. This is
 * what actually exercises the exact bug reported in production: a real
 * Figma desktop/browser session isn't available in this environment, but
 * the fake pluginData store in tests/helpers/fakeFigma.ts enforces the same
 * 100kB-per-entry limit that Figma itself enforces (and throws the same
 * way), so this test fails the same way the real plugin did if the storage
 * fix regresses.
 */

const PLUGIN_DATA_LIMIT_BYTES = 100_000;
const encoder = new TextEncoder();

describe("release flow (simulated Figma runtime)", () => {
  it("completes baseline -> scan -> release without throwing, and stays under the 100kB pluginData limit", async () => {
    const { send, components, componentSet, pluginData } = await loadMainWithFakeFigma();

    const initial = await send({ type: "ui-ready" });
    expect(initial.some((m) => m.type === "state")).toBe(true);

    const discovered = await send({ type: "discover-components", scope: "document", pageIds: [] });
    const discoveredMsg = discovered.find((m) => m.type === "discovered-components");
    expect(discoveredMsg?.type).toBe("discovered-components");
    const componentIds =
      discoveredMsg?.type === "discovered-components" ? discoveredMsg.components.map((c) => c.id) : [];
    expect(componentIds).toHaveLength(components.length + 1); // + the component set

    const baselineMessages = await send({
      type: "create-baseline",
      name: "Initial Design System",
      version: "1.0.0",
      description: "Fixture baseline",
      tracking: {
        components: { scope: "document", includedIds: componentIds, pageIds: [] },
        tokens: { enabled: true, includedCollectionIds: [] },
      },
    });
    const baselineCreated = baselineMessages.find((m) => m.type === "baseline-created");
    expect(baselineCreated?.type).toBe("baseline-created");
    if (baselineCreated?.type !== "baseline-created") throw new Error("unreachable");
    expect(baselineCreated.baseline.snapshot.components).toHaveLength(componentIds.length);
    expect(baselineCreated.baseline.snapshot.tokens).toHaveLength(40);

    // Simulate a designer editing the file: change a fill, remove a
    // variant, rename a component.
    const editedComponent = components[0];
    if (!editedComponent) throw new Error("unreachable");
    editedComponent.fills = [{ type: "SOLID", visible: true, opacity: 1, color: { r: 1, g: 0, b: 0 } }];
    editedComponent.name = "按钮 Button (Updated) 🔘";
    componentSet.children = (componentSet.children ?? []).slice(0, 2); // drop the "Large" variant

    const scanMessages = await send({ type: "scan" });
    const scanComplete = scanMessages.find((m) => m.type === "scan-complete");
    expect(scanComplete?.type).toBe("scan-complete");
    if (scanComplete?.type !== "scan-complete") throw new Error("unreachable");
    expect(scanComplete.changeSet.changes.length).toBeGreaterThan(0);
    expect(scanComplete.changeSet.changes.some((c) => c.changeType === "component-renamed")).toBe(true);
    expect(scanComplete.changeSet.changes.some((c) => c.changeType === "variant-removed")).toBe(true);

    const releaseMessages = await send({
      type: "create-release",
      version: "1.1.0",
      title: "Button + Badge updates",
      description: "Fixture release",
      include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
    });
    const releaseCreated = releaseMessages.find((m) => m.type === "release-created");
    expect(releaseCreated?.type).toBe("release-created");
    if (releaseCreated?.type !== "release-created") throw new Error("unreachable");
    expect(releaseCreated.release.changelogMarkdown).toContain("# Design System v1.1.0");
    expect(releaseCreated.release.changelogMarkdown).toContain("Badge");

    expect(releaseMessages.some((m) => m.type === "error")).toBe(false);

    for (const [, value] of pluginData) {
      expect(encoder.encode(value).length).toBeLessThanOrEqual(PLUGIN_DATA_LIMIT_BYTES);
    }
  });
});
