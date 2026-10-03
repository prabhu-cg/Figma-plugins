import { describe, expect, it } from "vitest";
import { loadMainWithFakeFigma } from "./helpers/fakeFigma";
import type { PluginToUiMessage } from "@shared/types/messages";

type Harness = Awaited<ReturnType<typeof loadMainWithFakeFigma>>;

function errorOf(messages: PluginToUiMessage[]): string | undefined {
  const m = messages.find((x) => x.type === "error");
  return m?.type === "error" ? m.message : undefined;
}

function stateOf(messages: PluginToUiMessage[]) {
  const m = messages.find((x) => x.type === "state");
  if (m?.type !== "state") throw new Error("no state message");
  return m.project;
}

// The fake UI receives the live project object, so deep-copy when comparing before/after.
const frozen = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

async function createBaseline(send: Harness["send"], version = "1.0.0") {
  const discovered = await send({ type: "discover-components", scope: "document", pageIds: [] });
  const d = discovered.find((m) => m.type === "discovered-components");
  const ids = d?.type === "discovered-components" ? d.components.map((c) => c.id) : [];
  const msgs = await send({
    type: "create-baseline",
    name: "Design System",
    version,
    tracking: {
      components: { scope: "document", includedIds: ids, pageIds: [] },
      tokens: { enabled: true, includedCollectionIds: [] },
    },
  });
  const created = msgs.find((m) => m.type === "baseline-created");
  if (created?.type !== "baseline-created") throw new Error("baseline not created");
  return created.baseline;
}

describe("main.ts message handling", () => {
  describe("initial state", () => {
    it.each(["ui-ready", "get-state"] as const)("%s replies with the project state", async (type) => {
      const { send } = await loadMainWithFakeFigma();
      const project = stateOf(await send({ type }));
      expect(project.baselines).toEqual([]);
      expect(project.releases).toEqual([]);
      expect(project.changeSets).toEqual([]);
    });

    it("ignores unknown message types without replying or throwing", async () => {
      const { send } = await loadMainWithFakeFigma();
      const msgs = await send({ type: "does-not-exist" } as never);
      expect(msgs).toEqual([]);
    });
  });

  describe("requests that need a baseline", () => {
    it("scan without a baseline reports an error and persists nothing", async () => {
      const { send, pluginData, clientStorageData } = await loadMainWithFakeFigma();
      const msgs = await send({ type: "scan" });
      expect(errorOf(msgs)).toMatch(/no baseline/i);
      expect(msgs.some((m) => m.type === "scan-complete")).toBe(false);
      expect(pluginData.size + clientStorageData.size).toBe(0);
    });

    it("create-release without a baseline reports an error", async () => {
      const { send } = await loadMainWithFakeFigma();
      const msgs = await send({
        type: "create-release",
        version: "1.1.0",
        title: "x",
        include: { added: true, changed: true, removed: true } as never,
      });
      expect(errorOf(msgs)).toMatch(/no baseline/i);
      expect(msgs.some((m) => m.type === "release-created")).toBe(false);
    });
  });

  describe("not-found errors", () => {
    it.each([
      ["export", { type: "export", format: "markdown", releaseId: "nope" }, /release not found/i],
      [
        "update-change",
        { type: "update-change", changeSetId: "nope", changeId: "nope", reviewState: "reviewed" },
        /change not found/i,
      ],
      [
        "bulk-update-review",
        { type: "bulk-update-review", changeSetId: "nope", changeIds: ["a"], reviewState: "reviewed" },
        /change set not found/i,
      ],
      [
        "confirm-rename",
        { type: "confirm-rename", changeSetId: "nope", addedChangeId: "a", removedChangeId: "b" },
        /rename suggestion not found/i,
      ],
      ["unmark-deprecated", { type: "unmark-deprecated", entityId: "nope" }, /tracked entity not found/i],
      [
        "compare-releases",
        { type: "compare-releases", releaseIdA: "a", releaseIdB: "b" },
        /could not find both releases/i,
      ],
    ] as const)("%s reports a readable error", async (_name, message, pattern) => {
      const { send } = await loadMainWithFakeFigma();
      const msgs = await send(message as never);
      expect(errorOf(msgs)).toMatch(pattern);
    });
  });

  describe("review updates", () => {
    it("update-change applies only the fields provided and clears manualClassification on null", async () => {
      const { send } = await loadMainWithFakeFigma();
      const baseline = await createBaseline(send);
      const project = stateOf(await send({ type: "get-state" }));
      const changeSet = project.changeSets.find((cs) => cs.baselineId === baseline.id)!;
      const change = changeSet.changes[0]!;

      await send({
        type: "update-change",
        changeSetId: changeSet.id,
        changeId: change.id,
        reviewNote: "looks fine",
        manualClassification: { classification: "breaking", reason: "manual" } as never,
      });
      let updated = stateOf(await send({ type: "get-state" }))
        .changeSets.find((cs) => cs.id === changeSet.id)!
        .changes.find((c) => c.id === change.id)!;
      expect(updated.reviewNote).toBe("looks fine");
      expect(updated.reviewState).toBe(change.reviewState);
      expect(updated.manualClassification).toBeDefined();

      await send({
        type: "update-change",
        changeSetId: changeSet.id,
        changeId: change.id,
        manualClassification: null,
      });
      updated = stateOf(await send({ type: "get-state" }))
        .changeSets.find((cs) => cs.id === changeSet.id)!
        .changes.find((c) => c.id === change.id)!;
      expect(updated.manualClassification).toBeUndefined();
      expect(updated.reviewNote).toBe("looks fine");
    });

    it("bulk-update-review only touches the listed changes, and announces them as a patch", async () => {
      const { send } = await loadMainWithFakeFigma();
      const baseline = await createBaseline(send);
      const project = stateOf(await send({ type: "get-state" }));
      const changeSet = project.changeSets.find((cs) => cs.baselineId === baseline.id)!;
      const [first, second] = changeSet.changes;
      const secondBefore = second!.reviewState;

      const msgs = await send({
        type: "bulk-update-review",
        changeSetId: changeSet.id,
        changeIds: [first!.id, "unknown-id"],
        reviewState: "accepted",
      });
      expect(msgs.find((m) => m.type === "changes-updated")).toEqual({
        type: "changes-updated",
        changeSetId: changeSet.id,
        patches: [{ changeId: first!.id, reviewState: "accepted" }],
      });
      expect(msgs.some((m) => m.type === "state")).toBe(false); // no whole-project resend

      const changes = stateOf(await send({ type: "get-state" })).changeSets.find((cs) => cs.id === changeSet.id)!.changes;
      expect(changes.find((c) => c.id === first!.id)!.reviewState).toBe("accepted");
      expect(changes.find((c) => c.id === second!.id)!.reviewState).toBe(secondBefore);
    });
  });

  describe("settings and persistence", () => {
    it("update-settings replaces the project settings", async () => {
      const { send } = await loadMainWithFakeFigma();
      const current = stateOf(await send({ type: "get-state" })).settings;
      const next = { ...current, tracking: { ...current.tracking, tokens: !current.tracking.tokens } };
      expect(stateOf(await send({ type: "update-settings", settings: next })).settings).toEqual(next);
      expect(stateOf(await send({ type: "get-state" })).settings).toEqual(next);
    });

    it("a baseline persists to storage so a fresh get-state sees it", async () => {
      const { send, pluginData, clientStorageData } = await loadMainWithFakeFigma();
      await createBaseline(send);
      expect(pluginData.size + clientStorageData.size).toBeGreaterThan(0);
      const project = stateOf(await send({ type: "get-state" }));
      expect(project.baselines).toHaveLength(1);
      expect(project.currentBaselineId).toBe(project.baselines[0]!.id);
    });
  });

  describe("releases", () => {
    it("export returns the stored changelog in the requested format", async () => {
      const { send } = await loadMainWithFakeFigma();
      await createBaseline(send);
      const created = await send({
        type: "create-release",
        version: "1.1.0",
        title: "First",
        include: { added: true, changed: true, removed: true } as never,
      });
      const release = created.find((m) => m.type === "release-created");
      if (release?.type !== "release-created") throw new Error("no release");

      const md = (await send({ type: "export", format: "markdown", releaseId: release.release.id })).find(
        (m) => m.type === "export-result",
      );
      const json = (await send({ type: "export", format: "json", releaseId: release.release.id })).find(
        (m) => m.type === "export-result",
      );
      expect(md?.type === "export-result" && md.content).toBe(release.release.changelogMarkdown);
      expect(json?.type === "export-result" && JSON.parse(json.content)).toBeTruthy();
    });

    it("compare-releases is read-only: it does not add change sets", async () => {
      const { send } = await loadMainWithFakeFigma();
      await createBaseline(send);
      const include = { added: true, changed: true, removed: true } as never;
      const r1 = (await send({ type: "create-release", version: "1.1.0", title: "a", include })).find(
        (m) => m.type === "release-created",
      );
      const r2 = (await send({ type: "create-release", version: "1.2.0", title: "b", include })).find(
        (m) => m.type === "release-created",
      );
      if (r1?.type !== "release-created" || r2?.type !== "release-created") throw new Error("no release");

      const before = stateOf(await send({ type: "get-state" })).changeSets.length;
      const msgs = await send({
        type: "compare-releases",
        releaseIdA: r1.release.id,
        releaseIdB: r2.release.id,
      });
      expect(msgs.some((m) => m.type === "release-comparison-result")).toBe(true);
      expect(stateOf(await send({ type: "get-state" })).changeSets.length).toBe(before);
    });
  });

  describe("focus-node", () => {
    it("selects the node and switches to its page", async () => {
      const { send, components } = await loadMainWithFakeFigma();
      const fig = (globalThis as never as { figma: { currentPage: { selection: unknown[] } } }).figma;
      const msgs = await send({ type: "focus-node", nodeId: components[0]!.id });
      expect(errorOf(msgs)).toBeUndefined();
      expect(fig.currentPage.selection).toEqual([components[0]]);
    });

    it("does nothing for a missing node and ignores page nodes", async () => {
      const { send, page } = await loadMainWithFakeFigma();
      expect(await send({ type: "focus-node", nodeId: "missing" })).toEqual([]);
      expect(await send({ type: "focus-node", nodeId: page.id })).toEqual([]);
    });

    it("reports an error if Figma throws while focusing", async () => {
      const { send, components } = await loadMainWithFakeFigma();
      const fig = (globalThis as never as { figma: { viewport: { scrollAndZoomIntoView: () => void } } }).figma;
      fig.viewport.scrollAndZoomIntoView = () => {
        throw new Error("boom");
      };
      expect(errorOf(await send({ type: "focus-node", nodeId: components[0]!.id }))).toMatch(/could not locate/i);
    });
  });

  describe("unexpected failures", () => {
    it("surfaces a thrown storage error as an error message instead of crashing", async () => {
      const { send } = await loadMainWithFakeFigma();
      await createBaseline(send);
      const fig = (globalThis as never as { figma: { clientStorage: { setAsync: () => Promise<void> } } }).figma;
      // Settings live in clientStorage, so that is the write a settings change makes.
      fig.clientStorage.setAsync = async () => {
        throw new Error("storage full");
      };
      const current = stateOf(await send({ type: "get-state" })).settings;
      const changed = { ...current, tracking: { ...current.tracking, tokens: !current.tracking.tokens } };
      const msgs = await send({ type: "update-settings", settings: changed });
      expect(errorOf(msgs)).toMatch(/storage full|save|persist/i);
    });

    it("rolls back in-memory changes when a save that must succeed fails", async () => {
      const { send } = await loadMainWithFakeFigma();
      const baseline = await createBaseline(send);
      const before = frozen(stateOf(await send({ type: "get-state" })));
      const change = before.changeSets.find((cs) => cs.baselineId === baseline.id)!.changes[0]!;
      const fig = (globalThis as never as {
        figma: { root: { setPluginData: () => void }; clientStorage: { setAsync: () => Promise<void> } };
      }).figma;
      const originalSet = fig.root.setPluginData;
      const originalSetAsync = fig.clientStorage.setAsync;
      fig.root.setPluginData = () => {
        throw new Error("storage full");
      };
      fig.clientStorage.setAsync = async () => {
        throw new Error("storage full");
      };

      // Each of these mutates `project` before persist() throws.
      expect(
        errorOf(await send({ type: "mark-deprecated", entityId: change.entityId, kind: "component", displayName: "X" })),
      ).toBeDefined();
      expect(
        errorOf(
          await send({
            type: "update-settings",
            settings: { ...before.settings, tracking: { ...before.settings.tracking, tokens: !before.settings.tracking.tokens } },
          }),
        ),
      ).toBeDefined();

      fig.root.setPluginData = originalSet;
      fig.clientStorage.setAsync = originalSetAsync;
      expect(frozen(stateOf(await send({ type: "get-state" })))).toEqual(before);
    });

    it("a review edit shows at once; if the background save fails the user is told, the edit is kept, and the next save writes it", async () => {
      const { send } = await loadMainWithFakeFigma();
      const baseline = await createBaseline(send);
      const changeSet = stateOf(await send({ type: "get-state" })).changeSets.find((cs) => cs.baselineId === baseline.id)!;
      const [first, second] = changeSet.changes;
      const fig = (globalThis as never as { figma: { root: { setPluginData: () => void } } }).figma;
      const originalSet = fig.root.setPluginData;
      fig.root.setPluginData = () => {
        throw new Error("storage full");
      };

      const msgs = await send({ type: "update-change", changeSetId: changeSet.id, changeId: first!.id, reviewState: "accepted" });
      expect(msgs.some((m) => m.type === "changes-updated")).toBe(true); // the UI was told immediately
      expect(errorOf(msgs)).toMatch(/Couldn't save your latest changes.*storage full/);
      // Not rolled back: the edit is still there for this session.
      const kept = stateOf(await send({ type: "get-state" })).changeSets.find((cs) => cs.id === changeSet.id)!.changes;
      expect(kept.find((c) => c.id === first!.id)!.reviewState).toBe("accepted");

      // The next change succeeds, and its save also writes the earlier edit that had failed.
      fig.root.setPluginData = originalSet;
      await send({ type: "update-change", changeSetId: changeSet.id, changeId: second!.id, reviewState: "rejected" });
      const { loadProject } = await import("@plugin/storage");
      const stored = (await loadProject()).changeSets.find((cs) => cs.id === changeSet.id)!.changes;
      expect(stored.find((c) => c.id === first!.id)!.reviewState).toBe("accepted");
      expect(stored.find((c) => c.id === second!.id)!.reviewState).toBe("rejected");
    });

    it("a failed scan does not leave a half-applied change set or stale scan cache", async () => {
      const { send } = await loadMainWithFakeFigma();
      await createBaseline(send);
      const before = frozen(stateOf(await send({ type: "get-state" })));
      const fig = (globalThis as never as { figma: { root: { setPluginData: () => void } } }).figma;
      const originalSet = fig.root.setPluginData;
      fig.root.setPluginData = () => {
        throw new Error("storage full");
      };
      expect(errorOf(await send({ type: "scan" }))).toBeDefined();
      fig.root.setPluginData = originalSet;

      expect(stateOf(await send({ type: "get-state" })).changeSets).toHaveLength(before.changeSets.length);
    });
  });
});
