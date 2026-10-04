import { beforeAll, describe, expect, it } from "vitest";
import {
  findOwn,
  hasBoundVariableAt,
  hasIconAncestor,
  hasStyleApplied,
  isHiddenInTree,
  ownNodes
} from "../src/plugin/rules/helpers";
import { installFigmaStub, node } from "./fakes";

beforeAll(() => installFigmaStub());

describe("ownNodes", () => {
  it("includes the root and its descendants", () => {
    const leaf = node({ name: "leaf" });
    const root = node({ name: "root", children: [leaf] });
    expect(ownNodes(root).map((n) => n.name).sort()).toEqual(["leaf", "root"]);
  });

  it("includes an instance but not its internals", () => {
    const inner = node({ name: "inner" });
    const instance = node({ type: "INSTANCE", name: "inst", children: [inner] });
    const root = node({ name: "root", children: [instance] });
    const names = ownNodes(root).map((n) => n.name);
    expect(names).toContain("inst");
    expect(names).not.toContain("inner");
  });

  it("does not descend into nested components (they're audited as their own record)", () => {
    const inner = node({ name: "inner" });
    const nested = node({ type: "COMPONENT", name: "nested", children: [inner] });
    const root = node({ type: "COMPONENT", name: "root", children: [nested] });
    expect(ownNodes(root).map((n) => n.name)).not.toContain("inner");
  });

  it("caches per root", () => {
    const root = node({ children: [node()] });
    expect(ownNodes(root)).toBe(ownNodes(root));
  });
});

describe("findOwn", () => {
  it("excludes the root even if it matches", () => {
    const root = node({ type: "TEXT", children: [node({ type: "TEXT" })] });
    expect(findOwn(root, (n) => n.type === "TEXT")).toHaveLength(1);
  });
});

describe("tree helpers", () => {
  it("detects hidden ancestors", () => {
    const leaf = node();
    node({ visible: false, children: [leaf] });
    expect(isHiddenInTree(leaf)).toBe(true);
  });

  it("detects an icon-named ancestor below the root only", () => {
    const vector = node({ type: "VECTOR" });
    const iconFrame = node({ name: "Icon/Close", children: [vector] });
    const root = node({ name: "Icon Button", children: [iconFrame] });
    expect(hasIconAncestor(vector, root)).toBe(true);
    expect(hasIconAncestor(iconFrame, root)).toBe(false); // root's own name doesn't count
  });
});

describe("variable and style binding", () => {
  it("sees node-level bindings", () => {
    const n = node() as unknown as { boundVariables: unknown };
    n.boundVariables = { cornerRadius: { id: "v1" } };
    expect(hasBoundVariableAt(n as never, "cornerRadius")).toBe(true);
    expect(hasBoundVariableAt(n as never, "opacity")).toBe(false);
  });

  it("sees paint-level color bindings", () => {
    const n = node({ fills: [{ type: "SOLID", boundVariables: { color: { id: "v1" } } } as unknown as Paint] });
    expect(hasBoundVariableAt(n, "fills", 0)).toBe(true);
  });

  it("treats applied styles as tokenized, and mixed as styled", () => {
    const styled = node() as unknown as Record<string, unknown>;
    styled.fillStyleId = "S:1";
    expect(hasStyleApplied(styled as never, "fills")).toBe(true);
    styled.fillStyleId = "";
    expect(hasStyleApplied(styled as never, "fills")).toBe(false);
    styled.fillStyleId = Symbol("mixed");
    expect(hasStyleApplied(styled as never, "fills")).toBe(true);
  });
});
