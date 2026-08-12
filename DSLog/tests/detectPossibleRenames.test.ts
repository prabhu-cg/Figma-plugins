import { describe, expect, it } from "vitest";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import { diffSnapshots } from "@plugin/diff/diffSnapshots";
import type { ComponentInputLike, VariableInputLike } from "@plugin/scanner/types";

const emptyScanSummary = {
  componentsScanned: 0,
  componentsSkipped: 0,
  tokensScanned: 0,
  tokensSkipped: 0,
  skippedItems: [],
};

function makeComponentInput(overrides: Partial<ComponentInputLike> = {}): ComponentInputLike {
  return {
    id: "comp-1",
    key: "shared-key",
    name: "Button / Primary",
    type: "COMPONENT",
    remote: false,
    componentPropertyDefinitions: {
      Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium"] },
    },
    variants: [
      {
        id: "comp-1",
        name: "Button / Primary",
        variantProperties: { Size: "Medium" },
        node: { id: "comp-1", name: "Button / Primary", type: "COMPONENT", children: [] },
      },
    ],
    representative: {
      id: "comp-1",
      name: "Button / Primary",
      type: "COMPONENT",
      width: 100,
      height: 40,
      children: [{ id: "label", name: "Label", type: "TEXT", visible: true, children: [] }],
    },
    ...overrides,
  };
}

function makeTokenInput(overrides: Partial<VariableInputLike> = {}): VariableInputLike {
  return {
    id: "token-1",
    key: "shared-token-key",
    name: "spacing.300",
    collectionId: "coll-1",
    collectionName: "Primitives",
    resolvedType: "FLOAT",
    scopes: ["GAP"],
    remote: false,
    valuesByMode: [{ modeId: "light", modeName: "Light", value: 12 }],
    ...overrides,
  };
}

describe("detectPossibleRenames (via diffSnapshots)", () => {
  it("links a component-added change to its component-removed pair when the component key matches, even with a new node id", () => {
    const before = normalizeComponent(makeComponentInput());
    const after = normalizeComponent(
      makeComponentInput({
        id: "comp-2", // different node id — simulates delete+recreate
        name: "Button / Brand",
        variants: [
          {
            id: "comp-2",
            name: "Button / Brand",
            variantProperties: { Size: "Medium" },
            node: { id: "comp-2", name: "Button / Brand", type: "COMPONENT", children: [] },
          },
        ],
        representative: {
          id: "comp-2",
          name: "Button / Brand",
          type: "COMPONENT",
          width: 100,
          height: 40,
          children: [{ id: "label", name: "Label", type: "TEXT", visible: true, children: [] }],
        },
      }),
    );

    const changeSet = diffSnapshots(
      "baseline-1",
      { components: [before], tokens: [], collections: [] },
      { components: [after], tokens: [], collections: [] },
      emptyScanSummary,
    );

    const removed = changeSet.changes.find((c) => c.changeType === "component-removed");
    const added = changeSet.changes.find((c) => c.changeType === "component-added");
    expect(removed).toBeDefined();
    expect(added).toBeDefined();
    expect(added?.possibleRenameOf).toBe(removed?.id);
  });

  it("does not link unrelated added/removed components with different keys and different structure", () => {
    const before = normalizeComponent(makeComponentInput({ id: "comp-1", key: "key-a" }));
    const after = normalizeComponent(
      makeComponentInput({
        id: "comp-2",
        key: "key-b",
        name: "Totally Different",
        componentPropertyDefinitions: {
          Variant: { type: "VARIANT", defaultValue: "One", variantOptions: ["One", "Two", "Three"] },
        },
        variants: [
          { id: "comp-2", name: "One", variantProperties: { Variant: "One" }, node: { id: "comp-2", name: "One", type: "COMPONENT", children: [] } },
          { id: "comp-2b", name: "Two", variantProperties: { Variant: "Two" }, node: { id: "comp-2b", name: "Two", type: "COMPONENT", children: [] } },
        ],
        representative: {
          id: "comp-2",
          name: "Totally Different",
          type: "COMPONENT",
          width: 400,
          height: 400,
          children: [
            { id: "a", name: "A", type: "RECTANGLE", visible: true, children: [] },
            { id: "b", name: "B", type: "RECTANGLE", visible: true, children: [] },
            { id: "c", name: "C", type: "RECTANGLE", visible: true, children: [] },
          ],
        },
      }),
    );

    const changeSet = diffSnapshots(
      "baseline-1",
      { components: [before], tokens: [], collections: [] },
      { components: [after], tokens: [], collections: [] },
      emptyScanSummary,
    );

    const added = changeSet.changes.find((c) => c.changeType === "component-added");
    expect(added?.possibleRenameOf).toBeUndefined();
  });

  it("links a token-added change to its token-removed pair when the variable key matches", () => {
    const before = normalizeToken(makeTokenInput());
    const after = normalizeToken(makeTokenInput({ id: "token-2", name: "spacing.medium" }));

    const changeSet = diffSnapshots(
      "baseline-1",
      { components: [], tokens: [before], collections: [] },
      { components: [], tokens: [after], collections: [] },
      emptyScanSummary,
    );

    const removed = changeSet.changes.find((c) => c.changeType === "token-removed");
    const added = changeSet.changes.find((c) => c.changeType === "token-added");
    expect(added?.possibleRenameOf).toBe(removed?.id);
  });
});
