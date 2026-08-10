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

  it("captures variant option data", () => {
    const snapshot = normalizeComponent(baseInput());
    expect(snapshot.variants).toHaveLength(1);
    expect(snapshot.variants[0]?.properties.Size).toBe("Medium");
  });
});
