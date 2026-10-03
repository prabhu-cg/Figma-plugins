import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";
import { loadProject } from "@plugin/storage";
import type { PluginToUiMessage, UiToPluginMessage } from "@shared/types/messages";
import type { Project } from "@shared/types/project";

/* eslint-disable @typescript-eslint/no-explicit-any */

const settle = () => new Promise((resolve) => setTimeout(resolve, 60));

async function setup() {
  const env = await loadMainWithFakeFigma();
  const fig = (globalThis as any).figma;

  // Discover first, while `send` can still see the plugin's replies.
  const d = await env.send({ type: "discover-components", scope: "document", pageIds: [] });
  const dm = d.find((m) => m.type === "discovered-components");
  const ids = dm?.type === "discovered-components" ? dm.components.map((c) => c.id) : [];

  const received: PluginToUiMessage[] = [];
  fig.ui.postMessage = (m: PluginToUiMessage) => received.push(m);
  // Fired without waiting, exactly like two quick key presses.
  const fire = (message: UiToPluginMessage) => fig.ui.onmessage(message);
  return { ...env, fig, received, ids, fire };
}

function baselineMessage(ids: string[]): UiToPluginMessage {
  return {
    type: "create-baseline",
    name: "DS",
    version: "1.0.0",
    tracking: {
      components: { scope: "document", includedIds: ids, pageIds: [] },
      tokens: { enabled: true, includedCollectionIds: [] },
    },
  };
}

function latestState(received: PluginToUiMessage[]): Project {
  const state = [...received].reverse().find((m) => m.type === "state");
  if (state?.type !== "state") throw new Error("no state message");
  return state.project;
}

describe("message queue", () => {
  it("handles messages one at a time, in arrival order", async () => {
    const { fire, received, ids } = await setup();
    fire(baselineMessage(ids));
    fire({ type: "scan" }); // would find no baseline if it ran before create-baseline finished
    await settle();

    const types = received.map((m) => m.type).filter((t) => t === "baseline-created" || t === "scan-complete" || t === "error");
    expect(types).toEqual(["baseline-created", "scan-complete"]);
  });

  it("two quick saves with different sizes leave a stored project that loads intact", async () => {
    const { fire, received, ids } = await setup();
    fire(baselineMessage(ids));
    await settle();
    const project = latestState(received);
    const changeSet = project.changeSets[0]!;
    const [a, b] = changeSet.changes;

    // The second save is several chunks (40 KB each) larger than the first — the case that used to corrupt storage.
    fire({ type: "update-change", changeSetId: changeSet.id, changeId: a!.id, reviewNote: "A".repeat(1) });
    fire({ type: "update-change", changeSetId: changeSet.id, changeId: b!.id, reviewNote: "B".repeat(150_000) });
    await settle();

    const stored = await loadProject();
    expect(stored.baselines).toHaveLength(1);
    expect(stored.baselines[0]!.snapshot.components.length).toBeGreaterThan(0);
    const storedSet = stored.changeSets.find((cs) => cs.id === changeSet.id);
    expect(storedSet?.changes.find((c) => c.id === a!.id)?.reviewNote).toBe("A");
    expect(storedSet?.changes.find((c) => c.id === b!.id)?.reviewNote?.length).toBe(150_000);
  });

  it("a burst of reviews all land in storage", async () => {
    const { fire, received, ids } = await setup();
    fire(baselineMessage(ids));
    await settle();
    const changeSet = latestState(received).changeSets[0]!;

    for (const change of changeSet.changes.slice(0, 12)) {
      fire({ type: "update-change", changeSetId: changeSet.id, changeId: change.id, reviewState: "accepted" });
    }
    await settle();

    const stored = await loadProject();
    const states = stored.changeSets.find((cs) => cs.id === changeSet.id)!.changes.slice(0, 12).map((c) => c.reviewState);
    expect(states).toEqual(Array(12).fill("accepted"));
  });

  it("one message failing and rolling back does not undo a message that follows it", async () => {
    const { fire, received, ids, fig } = await setup();
    fire(baselineMessage(ids));
    await settle();
    const changeSet = latestState(received).changeSets[0]!;
    const target = changeSet.changes[0]!;

    // The next clientStorage write fails once — a settings change only writes meta there, so that is the first message's save.
    const realSet = fig.clientStorage.setAsync;
    let failures = 1;
    fig.clientStorage.setAsync = async (key: string, value: string) => {
      if (failures-- > 0) throw new Error("storage full");
      return realSet(key, value);
    };

    fire({ type: "update-settings", settings: { tracking: { components: false, tokens: false }, detection: { structural: false, tokens: false, properties: false, styles: false } } });
    fire({ type: "update-change", changeSetId: changeSet.id, changeId: target.id, reviewNote: "survives" });
    await settle();

    expect(received.some((m) => m.type === "error")).toBe(true);
    fire({ type: "get-state" }); // review edits send patches, so ask for the current state
    await settle();
    const state = latestState(received);
    expect(state.settings.tracking.components).toBe(true); // the failed settings change was rolled back
    expect(state.changeSets[0]!.changes.find((c) => c.id === target.id)?.reviewNote).toBe("survives");

    const stored = await loadProject();
    expect(stored.settings.tracking.components).toBe(true);
    expect(stored.changeSets[0]!.changes.find((c) => c.id === target.id)?.reviewNote).toBe("survives");
  });
});

describe("save coalescing", () => {
  it("a burst of review actions costs a handful of saves, not one per key press, and loses nothing", async () => {
    const { fire, received, ids } = await setup();
    const storage = await import("@plugin/storage");
    fire(baselineMessage(ids));
    await settle();
    const changeSet = latestState(received).changeSets[0]!;

    const { setPersistDebounce } = await import("@plugin/handlers/session");
    setPersistDebounce(120); // the production delay
    const saves: number[] = [];
    storage.setSaveLogger((stats) => {
      if (stats.partsWritten > 0) saves.push(stats.partsWritten);
    });
    const burst = changeSet.changes.slice(0, 25);
    for (const change of burst) {
      fire({ type: "update-change", changeSetId: changeSet.id, changeId: change.id, reviewState: "accepted" });
    }
    await new Promise((resolve) => setTimeout(resolve, 400)); // longer than the delay

    expect(saves).toHaveLength(1); // all 25 reviews, one save
    const stored = await storage.loadProject();
    const states = stored.changeSets.find((cs) => cs.id === changeSet.id)!.changes.slice(0, 25).map((c) => c.reviewState);
    expect(states).toEqual(Array(25).fill("accepted"));
  });

  it("the UI is told about every edit straight away, without waiting for storage", async () => {
    const { fire, received, ids, fig } = await setup();
    fire(baselineMessage(ids));
    await settle();
    const changeSet = latestState(received).changeSets[0]!;

    // Storage that never finishes: the patch must still go out.
    fig.clientStorage.setAsync = () => new Promise(() => {});
    fig.root.setPluginData = () => {};
    received.length = 0;
    fire({ type: "update-change", changeSetId: changeSet.id, changeId: changeSet.changes[0]!.id, reviewState: "accepted" });
    await new Promise((r) => setTimeout(r, 20));

    expect(received.filter((m) => m.type === "changes-updated")).toHaveLength(1);
  });
});
