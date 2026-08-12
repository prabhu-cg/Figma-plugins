import { describe, expect, it } from "vitest";
import { createFakeFigma } from "./helpers/fakeFigma";
import { scanInstances } from "@plugin/scanner/scanInstances";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("scanInstances", () => {
  it("counts instances per main component and records the nearest top-level frame as a 'potentially affected' container", async () => {
    const { fakeFigma, page, components, registerNode } = createFakeFigma();
    (globalThis as any).figma = fakeFigma;

    const targetComponent = components[0]!;

    const screenFrame: any = { id: "screen-1", name: "Checkout", type: "FRAME", parent: page, children: [] };
    registerNode(screenFrame);

    const instance1: any = {
      id: "inst-1",
      name: "Button Instance",
      type: "INSTANCE",
      parent: screenFrame,
      getMainComponentAsync: async () => targetComponent,
    };
    const instance2: any = {
      id: "inst-2",
      name: "Button Instance 2",
      type: "INSTANCE",
      parent: screenFrame,
      getMainComponentAsync: async () => targetComponent,
    };
    registerNode(instance1);
    registerNode(instance2);
    screenFrame.children = [instance1, instance2];
    page.children = [...(page.children ?? []), screenFrame];

    const index = await scanInstances();
    const entry = index.byComponentId[targetComponent.id];
    expect(entry?.count).toBe(2);
    expect(entry?.containerNames).toEqual(["Checkout"]);
    expect(entry?.sampleInstanceIds.sort()).toEqual(["inst-1", "inst-2"]);
    expect(index.totalInstancesScanned).toBe(2);
    expect(index.totalInstancesSkipped).toBe(0);
  });

  it("skips an instance whose main component can't be resolved, without failing the whole scan", async () => {
    const { fakeFigma, page, registerNode } = createFakeFigma();
    (globalThis as any).figma = fakeFigma;

    const badInstance: any = {
      id: "inst-bad",
      name: "Orphaned Instance",
      type: "INSTANCE",
      parent: page,
      getMainComponentAsync: async () => null,
    };
    registerNode(badInstance);
    page.children = [...(page.children ?? []), badInstance];

    const index = await scanInstances();
    expect(index.totalInstancesSkipped).toBeGreaterThanOrEqual(1);
    expect(Object.keys(index.byComponentId)).toHaveLength(0);
  });

  it("records the enclosing component when an instance sits inside another component's own live structure", async () => {
    const { fakeFigma, page, components, registerNode } = createFakeFigma();
    (globalThis as any).figma = fakeFigma;

    const targetComponent = components[0]!; // instanced component
    const cardComponent = components[1]!; // the "containing" component

    // Simulate Card containing an Icon instance directly in its own tree
    // (not via a wrapping page-level frame) — cardComponent.parent is the
    // page, so findContainerName would report "Component 1" as the
    // container, and findContainingComponentId should find cardComponent
    // itself as the enclosing COMPONENT ancestor.
    const nestedInstance: any = {
      id: "inst-nested",
      name: "Icon Instance",
      type: "INSTANCE",
      parent: cardComponent,
      getMainComponentAsync: async () => targetComponent,
    };
    registerNode(nestedInstance);
    cardComponent.children = [...(cardComponent.children ?? []), nestedInstance];

    const index = await scanInstances();
    const entry = index.byComponentId[targetComponent.id];
    expect(entry?.containingComponentIds).toEqual([cardComponent.id]);
  });

  it("skips a page that fails to load instead of aborting the entire scan", async () => {
    const { fakeFigma, page, components, registerNode } = createFakeFigma();
    (globalThis as any).figma = fakeFigma;

    const targetComponent = components[0]!;
    const instance: any = {
      id: "inst-1",
      name: "Button Instance",
      type: "INSTANCE",
      parent: page,
      getMainComponentAsync: async () => targetComponent,
    };
    registerNode(instance);
    page.children = [...(page.children ?? []), instance];

    // A second page that's inaccessible (e.g. the user lacks permission to
    // view it in a shared file) — loadAsync throws, same as it would for a
    // real Figma page under those conditions.
    const brokenPage: any = {
      id: "page-broken",
      name: "Broken Page",
      type: "PAGE",
      children: [],
      loadAsync: async () => {
        throw new Error("Cannot load page: access denied");
      },
      findAllWithCriteria: () => {
        throw new Error("should not be reached — loadAsync already threw");
      },
    };
    fakeFigma.root.children = [...fakeFigma.root.children, brokenPage];

    const progressCalls: Array<{ pagesDone: number; pagesTotal: number }> = [];
    const index = await scanInstances((progress) => progressCalls.push(progress));

    // The good page's instance is still counted...
    expect(index.byComponentId[targetComponent.id]?.count).toBe(1);
    // ...and the scan still reports completion for both pages rather than
    // hanging or rejecting because one of them failed.
    expect(progressCalls[progressCalls.length - 1]).toMatchObject({ pagesDone: 2, pagesTotal: 2 });
  });

  it("reports progress per page", async () => {
    const { fakeFigma } = createFakeFigma();
    (globalThis as any).figma = fakeFigma;

    const progressCalls: Array<{ pagesDone: number; pagesTotal: number }> = [];
    await scanInstances((progress) => progressCalls.push(progress));

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(progressCalls[progressCalls.length - 1]).toMatchObject({ pagesDone: 1, pagesTotal: 1 });
  });
});
