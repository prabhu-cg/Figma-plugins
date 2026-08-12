import { describe, expect, it } from "vitest";
import { normalizeComponent } from "@plugin/snapshot/normalizeComponent";
import { diffComponents } from "@plugin/diff/diffComponents";
import type { ComponentInputLike } from "@plugin/scanner/types";
import type { ComponentSnapshot } from "@shared/types/component";

function makeComponent(overrides: Partial<ComponentInputLike> = {}): ComponentSnapshot {
  const input: ComponentInputLike = {
    id: "comp-1",
    name: "Button",
    type: "COMPONENT",
    remote: false,
    componentPropertyDefinitions: {
      Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium"] },
    },
    variants: [
      { id: "v-small", name: "Size=Small", variantProperties: { Size: "Small" }, node: { id: "v-small", name: "Size=Small", type: "COMPONENT", children: [] } },
      { id: "v-medium", name: "Size=Medium", variantProperties: { Size: "Medium" }, node: { id: "v-medium", name: "Size=Medium", type: "COMPONENT", children: [] } },
    ],
    representative: {
      id: "comp-1",
      name: "Button",
      type: "COMPONENT",
      width: 100,
      height: 40,
      children: [{ id: "label", name: "Label", type: "TEXT", visible: true, children: [] }],
    },
    ...overrides,
  };
  return normalizeComponent(input);
}

describe("diffComponents", () => {
  it("detects an added component", () => {
    const changes = diffComponents([], [makeComponent()]);
    expect(changes).toHaveLength(1);
    expect(changes[0]?.changeType).toBe("component-added");
  });

  it("detects a removed component", () => {
    const changes = diffComponents([makeComponent()], []);
    expect(changes.some((c) => c.changeType === "component-removed")).toBe(true);
  });

  it("produces no changes for identical snapshots", () => {
    const component = makeComponent();
    const changes = diffComponents([component], [component]);
    expect(changes).toHaveLength(0);
  });

  it("detects a removed variant", () => {
    const before = makeComponent();
    const after = makeComponent({
      variants: [
        { id: "v-small", name: "Size=Small", variantProperties: { Size: "Small" }, node: { id: "v-small", name: "Size=Small", type: "COMPONENT", children: [] } },
      ],
    });
    const changes = diffComponents([before], [after]);
    const variantRemoved = changes.find((c) => c.changeType === "variant-removed");
    expect(variantRemoved).toBeDefined();
    expect(variantRemoved?.field).toBe("Size=Medium");
  });

  it("detects a component property type change as a distinct changeType from a value-only edit", () => {
    const before = makeComponent();
    const after = makeComponent({
      componentPropertyDefinitions: {
        Size: { type: "TEXT", defaultValue: "Medium", variantOptions: ["Small", "Medium"] },
      },
    });
    const changes = diffComponents([before], [after]);
    const typeChanged = changes.find((c) => c.changeType === "property-type-changed");
    expect(typeChanged).toBeDefined();
    expect(typeChanged?.field).toBe("Size");
    expect(changes.some((c) => c.changeType === "property-changed")).toBe(false);
  });

  it("detects an added component property", () => {
    const before = makeComponent();
    const after = makeComponent({
      componentPropertyDefinitions: {
        Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium"] },
        Disabled: { type: "BOOLEAN", defaultValue: false },
      },
    });
    const changes = diffComponents([before], [after]);
    const propertyAdded = changes.find((c) => c.changeType === "property-added");
    expect(propertyAdded?.field).toBe("Disabled");
  });

  it("detects a component rename by matching id", () => {
    const before = makeComponent();
    const after = makeComponent({ name: "Button v2" });
    const changes = diffComponents([before], [after]);
    expect(changes.some((c) => c.changeType === "component-renamed")).toBe(true);
  });

  it("detects structural child added/removed", () => {
    const before = makeComponent();
    const after = makeComponent({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        width: 100,
        height: 40,
        children: [
          { id: "label", name: "Label", type: "TEXT", visible: true, children: [] },
          { id: "icon", name: "Icon", type: "VECTOR", visible: true, children: [] },
        ],
      },
    });
    const changes = diffComponents([before], [after]);
    expect(changes.some((c) => c.changeType === "structure-child-added")).toBe(true);
  });

  it("detects fills changes on the root node", () => {
    const before = makeComponent({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        width: 100,
        height: 40,
        fills: [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }],
        children: [{ id: "label", name: "Label", type: "TEXT", visible: true, children: [] }],
      },
    });
    const after = makeComponent({
      representative: {
        id: "comp-1",
        name: "Button",
        type: "COMPONENT",
        width: 100,
        height: 40,
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 1 } }],
        children: [{ id: "label", name: "Label", type: "TEXT", visible: true, children: [] }],
      },
    });
    const changes = diffComponents([before], [after]);
    expect(changes.some((c) => c.changeType === "fills-changed")).toBe(true);
  });
});
