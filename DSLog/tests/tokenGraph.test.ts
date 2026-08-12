import { describe, expect, it } from "vitest";
import { normalizeToken } from "@plugin/snapshot/normalizeToken";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { buildTokenDependencyChain, directTokenUsers, getTokenImpact } from "@shared/utils/tokenGraph";
import type { VariableInputLike, ComponentInputLike } from "@plugin/scanner/types";

// color.text.primary --alias--> color.content.default --alias--> (raw value)
// color.content.default is bound directly by the Button component.
function makeTokens() {
  const base = normalizeToken({
    id: "base",
    name: "color.content.default",
    collectionId: "coll-1",
    collectionName: "Semantic",
    resolvedType: "COLOR",
    scopes: ["ALL_FILLS"],
    remote: false,
    valuesByMode: [{ modeId: "light", modeName: "Light", value: { r: 0.1, g: 0.1, b: 0.1 } }],
  } satisfies VariableInputLike);

  const middle = normalizeToken({
    id: "middle",
    name: "color.text.primary",
    collectionId: "coll-1",
    collectionName: "Semantic",
    resolvedType: "COLOR",
    scopes: ["ALL_FILLS"],
    remote: false,
    valuesByMode: [{ modeId: "light", modeName: "Light", value: { type: "VARIABLE_ALIAS", id: "base" } }],
    variableNamesById: { base: "color.content.default" },
  } satisfies VariableInputLike);

  const leaf = normalizeToken({
    id: "leaf",
    name: "button.text.color",
    collectionId: "coll-1",
    collectionName: "Component",
    resolvedType: "COLOR",
    scopes: ["ALL_FILLS"],
    remote: false,
    valuesByMode: [{ modeId: "light", modeName: "Light", value: { type: "VARIABLE_ALIAS", id: "middle" } }],
    variableNamesById: { middle: "color.text.primary" },
  } satisfies VariableInputLike);

  return [base, middle, leaf];
}

function makeButtonComponent(boundVariableId: string): ComponentInputLike {
  return {
    id: "button-1",
    name: "Button",
    type: "COMPONENT",
    remote: false,
    variants: [{ id: "button-1", name: "Button", node: { id: "button-1", name: "Button", type: "COMPONENT", children: [] } }],
    representative: {
      id: "button-1",
      name: "Button",
      type: "COMPONENT",
      children: [],
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      // ComponentSnapshot.tokens comes from the node's top-level
      // boundVariables map (extractTokenBindings), not from per-paint
      // boundVariables (which normalizes into PaintSnapshot.boundVariableId
      // instead) — this is what actually binds "fills[0]" to a variable.
      boundVariables: { fills: [{ id: boundVariableId }] },
    },
  };
}

describe("tokenGraph", () => {
  it("finds direct component users of a token via its binding", () => {
    const tokens = makeTokens();
    const component = normalizeComponent(makeButtonComponent("base"));
    const users = directTokenUsers([component], "base");
    expect(users.map((c) => c.identity.name)).toEqual(["Button"]);
  });

  it("computes transitive impact: a component bound to an aliasing token counts as an indirect dependent of the base token", () => {
    const tokens = makeTokens();
    const component = normalizeComponent(makeButtonComponent("leaf")); // bound to the far end of the chain
    const impact = getTokenImpact(tokens, [component], "base");

    expect(new Set(impact.aliasingTokenIds)).toEqual(new Set(["middle", "leaf"]));
    expect(impact.directComponentIds).toEqual([]);
    expect(impact.indirectComponentIds).toEqual(["button-1"]);
  });

  it("builds a downstream dependency chain from a base token through its aliasers to consuming components", () => {
    const tokens = makeTokens();
    const component = normalizeComponent(makeButtonComponent("leaf"));
    const chain = buildTokenDependencyChain(tokens, [component], "base");

    expect(chain?.tokenName).toBe("color.content.default");
    expect(chain?.children).toHaveLength(1);
    const middleNode = chain?.children[0];
    expect(middleNode?.tokenName).toBe("color.text.primary");
    expect(middleNode?.children).toHaveLength(1);
    const leafNode = middleNode?.children[0];
    expect(leafNode?.tokenName).toBe("button.text.color");
    expect(leafNode?.directComponentNames).toEqual(["Button"]);
  });
});
