import { describe, expect, it } from "vitest";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import type { ComponentInputLike } from "@plugin/scanner/types";

function baseInput(overrides: Partial<ComponentInputLike> = {}): ComponentInputLike {
  return {
    id: "comp-1",
    key: "key-1",
    name: "Button",
    type: "COMPONENT",
    description: "Primary button",
    remote: false,
    componentPropertyDefinitions: {
      Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium", "Large"] },
    },
    variants: [
      {
        id: "comp-1",
        name: "Button",
        variantProperties: { Size: "Medium" },
        node: {
          id: "comp-1",
          name: "Button",
          type: "COMPONENT",
          visible: true,
          width: 100,
          height: 40,
          children: [],
        },
      },
    ],
    representative: {
      id: "comp-1",
      name: "Button",
      type: "COMPONENT",
      visible: true,
      width: 100,
      height: 40,
      fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
      children: [
        {
          id: "comp-1-label",
          name: "Label",
          type: "TEXT",
          visible: true,
          width: 60,
          height: 16,
          children: [],
        },
      ],
    },
    ...overrides,
  };
}

describe("normalizeComponent", () => {
  it("produces a deterministic hash for identical input", () => {
    const a = normalizeComponent(baseInput());
    const b = normalizeComponent(baseInput());
    expect(a.hash).toBe(b.hash);
  });

  it("produces a different hash when structure changes", () => {
    const a = normalizeComponent(baseInput());
    const b = normalizeComponent(
      baseInput({
        representative: {
          id: "comp-1",
          name: "Button",
          type: "COMPONENT",
          visible: true,
          width: 120,
          height: 40,
          children: [],
        },
      }),
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it("normalizes component properties and sorts them", () => {
    const input = baseInput({
      componentPropertyDefinitions: {
        "Zeta#1": { type: "BOOLEAN", defaultValue: false },
        "Alpha#2": { type: "TEXT", defaultValue: "hi" },
      },
    });
    const snapshot = normalizeComponent(input);
    expect(snapshot.properties.map((p) => p.name)).toEqual(["Alpha", "Zeta"]);
  });

  it("handles mixed (symbol) property values without throwing", () => {
    const input = baseInput({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        visible: true,
        cornerRadius: Symbol("mixed"),
        fills: Symbol("mixed") as unknown as never,
        children: [],
      },
    });
    expect(() => normalizeComponent(input)).not.toThrow();
    const snapshot = normalizeComponent(input);
    expect(snapshot.structure.cornerRadius).toBeUndefined();
    expect(snapshot.structure.fills).toBeUndefined();
  });

  it("handles mixed (symbol) style ids without leaking a Symbol into the snapshot", () => {
    // Figma returns figma.mixed (a real JS Symbol) for fillStyleId/etc when
    // a node's styles are inconsistently applied internally. A Symbol can't
    // survive postMessage's structured clone — if one leaks into the
    // snapshot sent to the UI, Figma throws "in postMessage: Cannot unwrap
    // symbol" and the whole scan/baseline-create action dies.
    const input = baseInput({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        visible: true,
        fillStyleId: Symbol("mixed") as unknown as string,
        strokeStyleId: Symbol("mixed") as unknown as string,
        effectStyleId: Symbol("mixed") as unknown as string,
        textStyleId: Symbol("mixed") as unknown as string,
        children: [],
      },
    });
    expect(() => normalizeComponent(input)).not.toThrow();
    const snapshot = normalizeComponent(input);
    expect(snapshot.structure.styleBindings).toEqual([]);
    expect(snapshot.styles).toEqual([]);
    for (const binding of snapshot.styles) {
      expect(typeof binding.styleId).toBe("string");
    }
  });

  it("still records a real (non-mixed) style id normally", () => {
    const input = baseInput({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        visible: true,
        fillStyleId: "S:abc123",
        children: [],
      },
    });
    const snapshot = normalizeComponent(input);
    expect(snapshot.styles).toEqual([{ field: "fills", styleId: "S:abc123", styleType: "PAINT" }]);
  });

  it("captures variant option data", () => {
    const snapshot = normalizeComponent(baseInput());
    expect(snapshot.variants).toHaveLength(1);
    expect(snapshot.variants[0]?.properties.Size).toBe("Medium");
  });
});
