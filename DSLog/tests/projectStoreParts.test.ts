import { beforeEach, describe, expect, it } from "vitest";
import { createFakeFigma } from "./helpers/fakeFigma";
import { loadProject, saveProject, setSaveLogger, type SaveStats } from "@plugin/storage";
import { writeChunked } from "@plugin/storage/chunking";
import { pluginDataAdapter } from "@plugin/storage/pluginDataAdapter";
import { createEmptyProject, type Baseline, type Project } from "@shared/types/project";
import type { Change, ChangeSet } from "@shared/types/change";

/* eslint-disable @typescript-eslint/no-explicit-any */

let fig: any;
let writes: string[];
let stats: SaveStats[];
const last = <T,>(items: T[]): T => items[items.length - 1]!;

beforeEach(() => {
  const created = createFakeFigma();
  fig = created.fakeFigma;
  (globalThis as any).figma = fig;
  writes = [];
  const realSet = fig.root.setPluginData.bind(fig.root);
  fig.root.setPluginData = (key: string, value: string) => {
    if (value !== "") writes.push(key);
    return realSet(key, value);
  };
  stats = [];
  setSaveLogger((s) => stats.push(s));
});

const change = (id: string, overrides: Partial<Change> = {}): Change =>
  ({
    id, entityType: "component", entityId: `e-${id}`, entityName: id, category: "modified", severity: "minor",
    changeType: "x", summary: `summary ${id}`, breaking: false, potentialBreaking: false, reviewState: "unreviewed",
    createdAt: "2026-01-01T00:00:00.000Z", ...overrides,
  }) as Change;

const snapshotOf = (tag: string, n = 300) => ({
  components: Array.from({ length: n }, (_, i) => ({ identity: { id: `${tag}-${i}`, name: `${tag} component ${i}`, description: "d".repeat(60) } })) as any,
  tokens: [],
  collections: [],
});

function baseline(id: string, tag = id): Baseline {
  return {
    id, name: "DS", version: `${id}.0.0`, createdAt: "2026-01-01T00:00:00.000Z", snapshot: snapshotOf(tag),
    tracking: { components: { scope: "document", includedIds: [], pageIds: [] }, tokens: { enabled: true, includedCollectionIds: [] } },
  };
}

function changeSet(id: string, baselineId: string, count = 40): ChangeSet {
  return {
    id, baselineId, createdAt: `2026-01-0${id.length}T00:00:00.000Z`,
    changes: Array.from({ length: count }, (_, i) => change(`${id}-${i}`)),
    scanSummary: { componentsScanned: count, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
  };
}

function makeProject(): Project {
  const p = createEmptyProject(2);
  p.baselines = [baseline("b1"), baseline("b2")];
  p.currentBaselineId = "b2";
  p.changeSets = [changeSet("cs1", "b1"), changeSet("cs2", "b2")];
  return p;
}

const partsWritten = () => last(stats).partsWritten;
/** "dslog:cs:cs3:g2:chunk:0" -> "dslog:cs:cs3": which logical part a raw storage key belongs to. */
const partOf = (key: string) => /^dslog:(?:cs|snap):[^:]+|^dslog:[a-z]+/.exec(key)![0];
const pluginDataKeys = () => (fig.root.getPluginDataKeys() as string[]).filter((k) => fig.root.getPluginData(k) !== "");

describe("round trip", () => {
  it("stores and restores baselines, snapshots, change sets and the impact index", async () => {
    const project = makeProject();
    project.instanceIndex = { totalInstancesScanned: 3, instances: [] } as any;
    await saveProject(project);
    const loaded = await loadProject();

    expect(loaded.baselines.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(loaded.baselines[1]!.snapshot).toEqual(project.baselines[1]!.snapshot);
    expect(loaded.changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2"]);
    expect(loaded.changeSets[1]!.changes).toEqual(project.changeSets[1]!.changes);
    expect((loaded.instanceIndex as any).totalInstancesScanned).toBe(3);
    expect(loaded.currentBaselineId).toBe("b2");
  });

  it("an empty store loads as an empty project", async () => {
    const loaded = await loadProject();
    expect(loaded.baselines).toEqual([]);
    expect(loaded.changeSets).toEqual([]);
  });
});

describe("saving only what changed", () => {
  it("a repeat save with nothing changed writes nothing", async () => {
    const project = makeProject();
    await saveProject(project);
    writes.length = 0;
    await saveProject(project);
    expect(partsWritten()).toBe(0);
    expect(writes).toEqual([]);
  });

  it("editing one change rewrites only that change set (even when edited in place)", async () => {
    const project = makeProject();
    await saveProject(project);
    writes.length = 0;

    project.changeSets[1]!.changes[3]!.reviewState = "accepted"; // in-place, the way several handlers edit
    await saveProject(project);

    expect(partsWritten()).toBe(1);
    expect(writes.every((k) => k.startsWith("dslog:cs:cs2:"))).toBe(true);
    expect((await loadProject()).changeSets[1]!.changes[3]!.reviewState).toBe("accepted");
  });

  it("never rewrites an untouched snapshot or change set", async () => {
    const project = makeProject();
    await saveProject(project);
    writes.length = 0;
    project.changeSets[1]!.changes[0]!.reviewNote = "hello";
    await saveProject(project);
    expect(writes.some((k) => k.startsWith("dslog:snap:"))).toBe(false);
    expect(writes.some((k) => k.startsWith("dslog:cs:cs1:"))).toBe(false);
  });

  it("a settings-only change touches no plugin data at all", async () => {
    const project = makeProject();
    await saveProject(project);
    writes.length = 0;
    project.settings = { ...project.settings, tracking: { ...project.settings.tracking, tokens: !project.settings.tracking.tokens } };
    await saveProject(project);
    expect(writes).toEqual([]);
    expect(last(stats).partsWritten).toBe(1); // meta
    expect((await loadProject()).settings.tracking.tokens).toBe(project.settings.tracking.tokens);
  });

  it("a review costs far fewer bytes than the whole project", async () => {
    const project = makeProject();
    await saveProject(project);
    const full = last(stats).bytesWritten;
    project.changeSets[1]!.changes[0]!.reviewState = "rejected";
    await saveProject(project);
    expect(last(stats).bytesWritten).toBeLessThan(full / 3);
  });

  it("the first save after loading writes nothing (state is recognised as already stored)", async () => {
    await saveProject(makeProject());
    const loaded = await loadProject();
    writes.length = 0;
    await saveProject(loaded);
    expect(partsWritten()).toBe(0);
    expect(writes).toEqual([]);
  });

  it("rewrites everything if the store was wiped underneath us", async () => {
    const project = makeProject();
    await saveProject(project);
    for (const key of fig.root.getPluginDataKeys()) fig.root.setPluginData(key, "");
    writes.length = 0;
    await saveProject(project);
    expect(partsWritten()).toBeGreaterThan(3);
    expect((await loadProject()).changeSets).toHaveLength(2);
  });
});

describe("adding and removing parts", () => {
  it("a new change set writes just that part and the manifest", async () => {
    const project = makeProject();
    await saveProject(project);
    writes.length = 0;
    project.changeSets.push(changeSet("cs3", "b2"));
    await saveProject(project);

    expect(new Set(writes.map(partOf))).toEqual(new Set(["dslog:cs:cs3", "dslog:manifest"]));
    expect((await loadProject()).changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2", "cs3"]);
  });

  it("a change set dropped from the project is removed from storage", async () => {
    const project = makeProject();
    await saveProject(project);
    project.changeSets = project.changeSets.filter((cs) => cs.id !== "cs1");
    await saveProject(project);

    expect(pluginDataKeys().some((k) => k.startsWith("dslog:cs:cs1:"))).toBe(false);
    expect((await loadProject()).changeSets.map((cs) => cs.id)).toEqual(["cs2"]);
  });

  it("sweeps leftover parts from a crashed earlier save the next time the manifest changes", async () => {
    const project = makeProject();
    await saveProject(project);
    await writeChunked(pluginDataAdapter, "dslog:cs:ghost", { id: "ghost" }, 1000); // orphan
    project.changeSets.push(changeSet("cs3", "b2"));
    await saveProject(project);
    expect(pluginDataKeys().some((k) => k.startsWith("dslog:cs:ghost:"))).toBe(false);
  });

  it("removes the impact index part when it is cleared", async () => {
    const project = makeProject();
    project.instanceIndex = { totalInstancesScanned: 1, instances: [] } as any;
    await saveProject(project);
    expect(pluginDataKeys().some((k) => k.startsWith("dslog:instances:"))).toBe(true);
    project.instanceIndex = undefined;
    await saveProject(project);
    expect(pluginDataKeys().some((k) => k.startsWith("dslog:instances:"))).toBe(false);
    expect((await loadProject()).instanceIndex).toBeUndefined();
  });
});

describe("the original single-blob layout", () => {
  async function writeLegacy(project: Project) {
    const snapshots: Record<string, unknown> = {};
    for (const b of project.baselines) snapshots[b.id] = b.snapshot;
    await writeChunked(pluginDataAdapter, "dslog:heavy", { snapshots, changeSets: project.changeSets }, 40_000);
    const meta = {
      schemaVersion: project.schemaVersion, currentBaselineId: project.currentBaselineId,
      baselines: project.baselines.map(({ snapshot: _s, ...rest }) => rest),
      releases: project.releases, trackedEntities: project.trackedEntities, settings: project.settings,
    };
    await fig.clientStorage.setAsync("dslog:meta:chunk:0", JSON.stringify(meta));
    await fig.clientStorage.setAsync("dslog:meta:index", JSON.stringify({ count: 1 }));
  }

  it("is still readable", async () => {
    const project = makeProject();
    await writeLegacy(project);
    const loaded = await loadProject();
    expect(loaded.baselines.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(loaded.baselines[0]!.snapshot).toEqual(project.baselines[0]!.snapshot);
    expect(loaded.changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2"]);
  });

  it("is converted by the next save, and the old blob is removed", async () => {
    await writeLegacy(makeProject());
    const loaded = await loadProject();
    await saveProject(loaded);

    const keys = pluginDataKeys();
    expect(keys.some((k) => k.startsWith("dslog:heavy"))).toBe(false);
    expect(keys.some((k) => k.startsWith("dslog:manifest"))).toBe(true);
    const again = await loadProject();
    expect(again.changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2"]);
    expect(again.baselines[1]!.snapshot).toEqual(loaded.baselines[1]!.snapshot);
  });
});

describe("damage and failures", () => {
  it("a missing snapshot part leaves the baseline in place with an empty snapshot", async () => {
    await saveProject(makeProject());
    for (const key of pluginDataKeys().filter((k) => k.startsWith("dslog:snap:b1"))) fig.root.setPluginData(key, "");
    const loaded = await loadProject();
    expect(loaded.baselines.map((b) => b.id)).toEqual(["b1", "b2"]);
    expect(loaded.baselines[0]!.snapshot.components).toEqual([]);
    expect(loaded.baselines[1]!.snapshot.components.length).toBeGreaterThan(0);
  });

  it("a missing change-set part drops only that change set", async () => {
    await saveProject(makeProject());
    for (const key of pluginDataKeys().filter((k) => k.startsWith("dslog:cs:cs1"))) fig.root.setPluginData(key, "");
    expect((await loadProject()).changeSets.map((cs) => cs.id)).toEqual(["cs2"]);
  });

  it("a write that fails part-way leaves the previous project loadable, and the next save finishes the job", async () => {
    const project = makeProject();
    await saveProject(project);
    project.changeSets[1]!.changes[0]!.reviewState = "accepted";
    project.changeSets.push(changeSet("cs3", "b2"));

    const realSet = fig.root.setPluginData;
    fig.root.setPluginData = () => {
      throw new Error("plugin data limit");
    };
    await expect(saveProject(project)).rejects.toThrow("plugin data limit");
    fig.root.setPluginData = realSet;

    const during = await loadProject();
    expect(during.changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2"]);
    expect(during.changeSets[1]!.changes[0]!.reviewState).toBe("unreviewed");

    await saveProject(project);
    const after = await loadProject();
    expect(after.changeSets.map((cs) => cs.id)).toEqual(["cs1", "cs2", "cs3"]);
    expect(after.changeSets[1]!.changes[0]!.reviewState).toBe("accepted");
  });

  it("does not remember a failed write as saved", async () => {
    const project = makeProject();
    await saveProject(project);
    project.changeSets[1]!.changes[0]!.reviewState = "rejected";
    const realSet = fig.root.setPluginData;
    fig.root.setPluginData = () => {
      throw new Error("boom");
    };
    await expect(saveProject(project)).rejects.toThrow();
    fig.root.setPluginData = realSet;

    writes.length = 0;
    await saveProject(project);
    expect(writes.some((k) => k.startsWith("dslog:cs:cs2:"))).toBe(true);
  });

  it("concurrent saves resolve in order and the last state wins", async () => {
    const project = makeProject();
    await saveProject(project);
    const saves: Promise<void>[] = [];
    for (let i = 0; i < 5; i++) {
      project.changeSets[1]!.changes[i]!.reviewState = "accepted";
      saves.push(saveProject(project));
    }
    await Promise.all(saves);
    const loaded = await loadProject();
    expect(loaded.changeSets[1]!.changes.slice(0, 5).map((c) => c.reviewState)).toEqual(Array(5).fill("accepted"));
  });
});

describe("save log", () => {
  it("reports what each save did", async () => {
    await saveProject(makeProject());
    const first = last(stats);
    expect(first.partsWritten).toBe(first.partsChecked - 0);
    expect(first.bytesWritten).toBeGreaterThan(0);
    await saveProject(makeProject());
    expect(last(stats).partsChecked).toBeGreaterThan(0);
  });
});
