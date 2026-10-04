import { beforeEach, describe, expect, it } from "vitest";
import { tokenRules } from "../src/plugin/rules/tokens";
import type { RuleContext } from "../src/plugin/rules/types";
import { installFigmaStub } from "./fakes";

const find = (id: string) => tokenRules.find((r) => r.id === id)!;

function variable(id: string, name: string, valuesByMode: Record<string, unknown>, collection = "c1"): Variable {
  return { id, name, valuesByMode, variableCollectionId: collection, resolvedType: "COLOR" } as unknown as Variable;
}

function context(variables: Variable[], nodes: unknown[] = []): RuleContext {
  const variablesByCollection = new Map<string, Variable[]>();
  for (const v of variables) variablesByCollection.set(v.variableCollectionId, [...(variablesByCollection.get(v.variableCollectionId) ?? []), v]);
  return {
    components: [],
    variables,
    variableCollections: [],
    collectionNameById: new Map([["c1", "Colors"]]),
    variablesByCollection,
    allComponentNodes: nodes,
    isCancelled: () => false
  } as unknown as RuleContext;
}

const alias = (id: string) => ({ type: "VARIABLE_ALIAS", id });

describe("tokens-broken-alias", () => {
  beforeEach(() => installFigmaStub({ variables: { getVariableByIdAsync: async (id: string) => (id === "lib:1" ? {} : null) } }));

  it("flags an alias whose target exists nowhere", async () => {
    const findings = await find("tokens-broken-alias").evaluate(context([variable("a", "bg", { m: alias("gone") })]));
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe("critical");
  });

  it("does not flag aliases to a local variable or to an enabled-library variable", async () => {
    const vars = [variable("a", "bg", { m: alias("b") }), variable("b", "base", { m: { r: 0, g: 0, b: 0 } }), variable("c", "fg", { m: alias("lib:1") })];
    expect(await find("tokens-broken-alias").evaluate(context(vars))).toEqual([]);
  });

  it("gives each broken alias its own key", async () => {
    const vars = [variable("a", "one", { m: alias("x") }), variable("b", "two", { m: alias("x") })];
    const keys = (await find("tokens-broken-alias").evaluate(context(vars))).map((f) => f.key);
    expect(new Set(keys).size).toBe(2);
  });
});

describe("tokens-unused-variable", () => {
  beforeEach(() => installFigmaStub());

  it("treats a variable aliased by another variable as used", async () => {
    const vars = [variable("a", "semantic", { m: alias("b") }), variable("b", "primitive", { m: { r: 1, g: 1, b: 1 } })];
    const names = (await find("tokens-unused-variable").evaluate(context(vars, [{ boundVariables: { fills: [{ id: "a" }] } }]))).map(
      (f) => f.meta?.variableName
    );
    expect(names).toEqual([]);
  });

  it("flags a variable nothing references", async () => {
    const findings = await find("tokens-unused-variable").evaluate(context([variable("a", "orphan", { m: 1 })]));
    expect(findings).toHaveLength(1);
  });

  it("counts bindings stored on the paint itself", async () => {
    const node = { fills: [{ type: "SOLID", boundVariables: { color: { id: "a" } } }] };
    expect(await find("tokens-unused-variable").evaluate(context([variable("a", "bg", { m: 1 })], [node]))).toEqual([]);
  });
});

describe("tokens-duplicate-variable", () => {
  it("pairs later duplicates with the first (N copies -> N-1 findings)", async () => {
    const same = { m: { r: 1, g: 0, b: 0 } };
    const vars = [variable("a", "red-a", same), variable("b", "red-b", same), variable("c", "red-c", same), variable("d", "blue", { m: { r: 0, g: 0, b: 1 } })];
    const findings = await find("tokens-duplicate-variable").evaluate(context(vars));
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.meta?.a === "red-a")).toBe(true);
  });
});
