import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";
import { saveProject } from "@plugin/storage";
import { createEmptyProject } from "@shared/types/project";
import type { ChangeSet } from "@shared/types/change";
import type { PluginToUiMessage, UiToPluginMessage } from "@shared/types/messages";
import type { Project } from "@shared/types/project";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Env = Awaited<ReturnType<typeof loadMainWithFakeFigma>>;

async function stateOf(send: Env["send"]): Promise<Project> {
  const msgs = await send({ type: "get-state" });
  const state = msgs.find((m) => m.type === "state");
  if (state?.type !== "state") throw new Error("no state");
  return JSON.parse(JSON.stringify(state.project));
}

async function createBaseline(send: Env["send"]) {
  const d = await send({ type: "discover-components", scope: "document", pageIds: [] });
  const dm = d.find((m) => m.type === "discovered-components");
  const ids = dm?.type === "discovered-components" ? dm.components.map((c) => c.id) : [];
  await send({
    type: "create-baseline", name: "DS", version: "1.0.0",
    tracking: { components: { scope: "document", includedIds: ids, pageIds: [] }, tokens: { enabled: true, includedCollectionIds: [] } },
  });
}

const include = { components: true, tokens: true, breakingChanges: true, migrationNotes: true };

describe("pruning stale change sets", () => {
  it("a scan replaces the previous change set for the baseline instead of piling up", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    expect((await stateOf(send)).changeSets).toHaveLength(1);

    nodeMap.get("comp-1")!.cornerRadius = 12;
    await send({ type: "scan" });
    const afterOne = await stateOf(send);
    expect(afterOne.changeSets).toHaveLength(1);
    const firstScanId = afterOne.changeSets[0]!.id;

    await send({ type: "scan" });
    await send({ type: "scan" });
    const afterThree = await stateOf(send);
    expect(afterThree.changeSets).toHaveLength(1);
    expect(afterThree.changeSets[0]!.id).not.toBe(firstScanId); // it is the newest scan, not the first
  });

  it("creating a release keeps the release's own change set and drops the old scans", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    await send({ type: "scan" });
    await send({ type: "scan" });

    await send({ type: "create-release", version: "1.1.0", title: "One", include });
    const state = await stateOf(send);
    expect(state.releases).toHaveLength(1);
    expect(state.changeSets.map((cs) => cs.id)).toEqual([state.releases[0]!.changeSetId]);
  });

  it("across several releases each release keeps its record and only the current scan is added", async () => {
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    await send({ type: "scan" });
    await send({ type: "create-release", version: "1.1.0", title: "One", include });
    nodeMap.get("comp-2")!.cornerRadius = 9;
    await send({ type: "scan" });
    await send({ type: "scan" });
    await send({ type: "create-release", version: "1.2.0", title: "Two", include });
    await send({ type: "scan" });

    const state = await stateOf(send);
    const releaseSets = state.releases.map((r) => r.changeSetId);
    expect(state.changeSets.map((cs) => cs.id).sort()).toEqual([...releaseSets, state.changeSets.find((cs) => !releaseSets.includes(cs.id))!.id].sort());
    expect(state.changeSets).toHaveLength(3); // two release records + the current scan
  });

  it("history no longer lists the same change once per scan", async () => {
    const { getEntityHistory } = await import("@shared/utils/entityHistory");
    const { send, nodeMap } = await loadMainWithFakeFigma();
    await createBaseline(send);
    nodeMap.get("comp-1")!.cornerRadius = 12;
    for (let i = 0; i < 4; i++) await send({ type: "scan" });

    const state = await stateOf(send);
    const entityId = state.changeSets[0]!.changes.find((c) => c.entityName.includes("Component 1"))!.entityId;
    const groups = getEntityHistory(state, entityId);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.changes.length).toBe(state.changeSets[0]!.changes.filter((c) => c.entityId === entityId).length);
  });

  it("the stored copy is pruned too", async () => {
    const { send } = await loadMainWithFakeFigma();
    await createBaseline(send);
    await send({ type: "scan" });
    await send({ type: "scan" });
    await new Promise((r) => setTimeout(r, 30));
    const { loadProject } = await import("@plugin/storage");
    expect((await loadProject()).changeSets).toHaveLength(1);
  });
});

describe("a project saved by an older version", () => {
  const stale = (id: string, createdAt: string): ChangeSet => ({
    id, baselineId: "b1", createdAt, changes: [],
    scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
  });

  it("is cleaned up when it is opened, and the cleaned copy is saved", async () => {
    const env = await loadMainWithFakeFigma();
    // Written with the test's own storage instance, as an earlier version would have left it.
    const project = createEmptyProject(2);
    project.baselines = [{
      id: "b1", name: "DS", version: "1.0.0", createdAt: "x",
      snapshot: { components: [], tokens: [], collections: [] },
      tracking: { components: { scope: "document", includedIds: [], pageIds: [] }, tokens: { enabled: true, includedCollectionIds: [] } },
    }];
    project.currentBaselineId = "b1";
    project.changeSets = [stale("old-1", "2026-01-01"), stale("old-2", "2026-01-02"), stale("newest", "2026-01-03")];
    await saveProject(project);

    // Re-import the plugin against that storage, like reopening it.
    const fresh = await import("./helpers/fakeFigma");
    void fresh;
    const { vi } = await import("vitest");
    vi.resetModules();
    await import("@plugin/main");
    (await import("@plugin/handlers/session")).setPersistDebounce(0);
    const fig = (globalThis as any).figma;
    const received: PluginToUiMessage[] = [];
    fig.ui.postMessage = (m: PluginToUiMessage) => received.push(m);
    fig.ui.onmessage({ type: "get-state" } as UiToPluginMessage);
    await new Promise((r) => setTimeout(r, 80));

    const state = received.find((m) => m.type === "state");
    if (state?.type !== "state") throw new Error("no state");
    expect(state.project.changeSets.map((cs) => cs.id)).toEqual(["newest"]);
    const { loadProject } = await import("@plugin/storage");
    expect((await loadProject()).changeSets.map((cs) => cs.id)).toEqual(["newest"]);
    void env;
  });
});
