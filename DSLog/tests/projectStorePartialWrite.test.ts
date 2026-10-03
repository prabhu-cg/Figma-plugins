import { beforeEach, describe, expect, it } from "vitest";
import { createFakeFigma } from "./helpers/fakeFigma";
import { loadProject, saveProject } from "@plugin/storage";
import { createEmptyProject } from "@shared/types/project";
import type { Baseline, Project } from "@shared/types/project";

/* eslint-disable @typescript-eslint/no-explicit-any */

function baseline(id: string, componentName: string): Baseline {
  return {
    id,
    name: "DS",
    version: id,
    tracking: {
      components: { scope: "document", includedIds: [], pageIds: [] },
      tokens: { enabled: false, includedCollectionIds: [] },
    },
    snapshot: {
      components: [{ identity: { id: `c-${id}`, name: componentName } } as never],
      tokens: [],
      collections: [],
    },
    createdAt: "2026-01-01T00:00:00.000Z",
  };
}

function projectWith(...ids: string[]): Project {
  const p = createEmptyProject(2);
  p.baselines = ids.map((id) => baseline(id, `Comp ${id}`));
  p.currentBaselineId = ids[ids.length - 1];
  return p;
}

let fig: any;

beforeEach(() => {
  const { fakeFigma } = createFakeFigma();
  fig = fakeFigma;
  (globalThis as any).figma = fakeFigma;
});

describe("saveProject partial-write safety", () => {
  it("round-trips a project", async () => {
    await saveProject(projectWith("v1", "v2"));
    const loaded = await loadProject();
    expect(loaded.baselines.map((b) => b.id)).toEqual(["v1", "v2"]);
    expect(loaded.baselines[1]!.snapshot.components[0]!.identity.name).toBe("Comp v2");
  });

  it("if saving heavy data fails, the previously saved project loads unchanged", async () => {
    await saveProject(projectWith("v1"));
    const original = fig.root.setPluginData;
    fig.root.setPluginData = () => {
      throw new Error("plugin data limit");
    };
    await expect(saveProject(projectWith("v1", "v2"))).rejects.toThrow("plugin data limit");
    fig.root.setPluginData = original;

    const loaded = await loadProject();
    expect(loaded.baselines.map((b) => b.id)).toEqual(["v1"]);
    expect(loaded.baselines[0]!.snapshot.components[0]!.identity.name).toBe("Comp v1");
  });

  it("if saving meta fails after heavy succeeded, no baseline loads with an empty snapshot", async () => {
    await saveProject(projectWith("v1"));
    fig.clientStorage.setAsync = async () => {
      throw new Error("client storage full");
    };
    await expect(saveProject(projectWith("v1", "v2"))).rejects.toThrow("client storage full");

    const loaded = await loadProject();
    // Old meta (only v1) still resolves against the newer heavy data.
    expect(loaded.baselines.map((b) => b.id)).toEqual(["v1"]);
    for (const b of loaded.baselines) {
      expect(b.snapshot.components.length).toBeGreaterThan(0);
    }
  });
});
