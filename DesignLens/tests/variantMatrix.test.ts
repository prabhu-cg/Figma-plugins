import { describe, expect, it } from "vitest";
import { cartesianProduct, comboKey } from "../src/plugin/rules/variantMatrix";

describe("cartesianProduct", () => {
  it("expands every combination", () => {
    const out = cartesianProduct([
      ["Size", ["S", "L"]],
      ["State", ["Default", "Hover", "Disabled"]]
    ]);
    expect(out).toHaveLength(6);
    expect(out).toContainEqual({ Size: "L", State: "Hover" });
  });

  it("yields a single empty combo for no properties", () => {
    expect(cartesianProduct([])).toEqual([{}]);
  });
});

describe("comboKey", () => {
  it("is order-independent", () => {
    expect(comboKey({ a: "1", b: "2" })).toBe(comboKey({ b: "2", a: "1" }));
  });
});
