import { describe, expect, it } from "vitest";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import { buildDependencyGraph, getComponentTokenIds, getDependentComponentIds } from "@shared/utils/dependencyGraph";
import type { ComponentInputLike, VariableInputLike } from "@plugin/scanner/types";
import type { InstanceIndex } from "@shared/types/instance";

function makeComponent(id: string, name: string, boundVariableId?: string): ComponentInputLike {
  return {
    id,
    name,
    type: "COMPONENT",
    remote: false,
    variants: [{ id, name, node: { id, name, type: "COMPONENT", children: [] } }],
    representative: {
      id,
      name,
      type: "COMPONENT",
      children: [],
      ...(boundVariableId ? { boundVariables: { fills: [{ id: boundVariableId }] } } : {}),
    },
  };
}

function makeToken(id: string, name: string): VariableInputLike {
  return {
    id,
    name,
    collectionId: "coll-1",
    collectionName: "Primitives",
    resolvedType: "COLOR",
    scopes: [],
    remote: false,
    valuesByMode: [{ modeId: "light", modeName: "Light", value: { r: 0, g: 0, b: 0 } }],
  };
}

describe("dependencyGraph", () => {
  it("builds usesToken and belongsTo edges from an already-scanned snapshot", () => {
    const button = normalizeComponent(makeComponent("button-1", "Button", "token-1"));
    const token = normalizeToken(makeToken("token-1", "color.text"));
    const snapshot = { components: [button], tokens: [token], collections: [] };

    const edges = buildDependencyGraph(snapshot);
    expect(edges).toContainEqual({ from: "button-1", fromType: "component", to: "token-1", toType: "token", relation: "usesToken" });
    expect(getComponentTokenIds(edges, "button-1")).toEqual(["token-1"]);
  });

  it("builds contains/instanceOf edges from an InstanceIndex", () => {
    const button = normalizeComponent(makeComponent("button-1", "Button"));
    const card = normalizeComponent(makeComponent("card-1", "Card"));
    const snapshot = { components: [button, card], tokens: [], collections: [] };

    const instanceIndex: InstanceIndex = {
      builtAt: "2026-01-01T00:00:00Z",
      totalInstancesScanned: 1,
      totalInstancesSkipped: 0,
      byComponentId: {
        "button-1": {
          componentId: "button-1",
          count: 1,
          containerNames: ["Checkout"],
          sampleInstanceIds: ["inst-1"],
          containingComponentIds: ["card-1"],
        },
      },
    };

    const edges = buildDependencyGraph(snapshot, instanceIndex);
    expect(getDependentComponentIds(edges, "button-1")).toEqual(["card-1"]);
    expect(edges).toContainEqual({ from: "inst-1", fromType: "instance", to: "button-1", toType: "component", relation: "instanceOf" });
  });
});
