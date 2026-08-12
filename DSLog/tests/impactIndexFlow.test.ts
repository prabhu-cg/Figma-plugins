import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";

describe("build-impact-index flow (simulated Figma runtime)", () => {
  it("scans document-wide instances through main.ts and persists the result onto the project", async () => {
    const { send, page, components, nodeMap } = await loadMainWithFakeFigma();

    const targetComponent = components[0]!;
    const screenFrame: any = { id: "screen-1", name: "Checkout", type: "FRAME", parent: page, children: [] };
    nodeMap.set(screenFrame.id, screenFrame);
    const instance: any = {
      id: "inst-1",
      name: "Button Instance",
      type: "INSTANCE",
      parent: screenFrame,
      getMainComponentAsync: async () => targetComponent,
    };
    nodeMap.set(instance.id, instance);
    screenFrame.children = [instance];
    page.children = [...(page.children ?? []), screenFrame];

    const messages = await send({ type: "build-impact-index" });
    const complete = messages.find((m) => m.type === "impact-index-complete");
    expect(complete?.type).toBe("impact-index-complete");
    if (complete?.type !== "impact-index-complete") throw new Error("unreachable");
    expect(complete.index.byComponentId[targetComponent.id]?.count).toBe(1);
    expect(complete.index.byComponentId[targetComponent.id]?.containerNames).toEqual(["Checkout"]);

    const stateMsg = messages.find((m) => m.type === "state");
    if (stateMsg?.type !== "state") throw new Error("unreachable");
    expect(stateMsg.project.instanceIndex?.byComponentId[targetComponent.id]?.count).toBe(1);
  });
});
