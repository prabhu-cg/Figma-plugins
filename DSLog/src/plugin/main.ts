import type { UiToPluginMessage } from "@shared/types/messages";
import type { Baseline, DesignSystemSnapshot, Project, Release } from "@shared/types/project";
import type { Change } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";
import { generateId } from "@shared/utils/id";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { loadProject, saveProject } from "@plugin/storage";
import { discoverComponents, scanComponents, scanInstances, scanTokens } from "@plugin/scanner";
import { diffSnapshots } from "@plugin/diff";
import { generateJson, generateMarkdown } from "@plugin/export";
import { postToUi } from "@plugin/utils/postMessage";

figma.showUI(__html__, { width: 1180, height: 760, themeColors: true });

let project: Project;
let latestScannedSnapshot: DesignSystemSnapshot | undefined;
let latestScanSummary:
  | {
      componentsScanned: number;
      componentsSkipped: number;
      tokensScanned: number;
      tokensSkipped: number;
      skippedItems: Array<{ id: string; name: string; reason: string }>;
    }
  | undefined;

async function ensureProject(): Promise<Project> {
  if (!project) {
    project = await loadProject();
  }
  return project;
}

async function persist(): Promise<void> {
  await saveProject(project);
}

function findCurrentBaseline(): Baseline | undefined {
  return project.baselines.find((b) => b.id === project.currentBaselineId);
}

/**
 * The id list a baseline was created with is a frozen snapshot; re-scanning
 * that exact list can never discover a node with a genuinely new id (e.g. a
 * component deleted and recreated under the same name — the real-world
 * "rename" case). For scope kinds that are re-discoverable from document
 * state (everything except "selection", which is inherently a one-time,
 * non-reproducible pick), re-run discovery each scan so newly-matching
 * components are picked up — this is what makes both "component added"
 * during a scan and rename-pair detection reachable at all.
 */
async function resolveComponentIds(baseline: Baseline): Promise<string[]> {
  const tracking = baseline.tracking.components;
  if (tracking.scope === "selection") return tracking.includedIds;
  const discovered = await discoverComponents(tracking.scope, tracking.pageIds);
  return discovered.map((d) => d.id);
}

/**
 * Appends a manually-created Change (deprecation) to the current baseline's
 * most recent ChangeSet, creating an empty one first if a scan hasn't run
 * yet — so manual actions flow through the same changelog/history/dashboard
 * machinery as scanned changes, with no parallel counting logic.
 */
function appendSyntheticChange(baselineId: string, change: Change): void {
  let changeSet = getLatestChangeSetForBaseline(project, baselineId);
  if (!changeSet) {
    changeSet = {
      id: generateId("changeset"),
      baselineId,
      createdAt: new Date().toISOString(),
      changes: [],
      scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
    };
    project.changeSets.push(changeSet);
  }
  changeSet.changes.push(change);
}

async function captureSnapshot(
  componentIds: string[],
  tokenCollectionIds: string[],
  tokensEnabled: boolean,
): Promise<{
  snapshot: DesignSystemSnapshot;
  scanSummary: {
    componentsScanned: number;
    componentsSkipped: number;
    tokensScanned: number;
    tokensSkipped: number;
    skippedItems: Array<{ id: string; name: string; reason: string }>;
  };
}> {
  const componentResult = await scanComponents(componentIds, (done, total) => {
    postToUi({
      type: "scan-progress",
      progress: { phase: "components", componentsTotal: total, componentsDone: done, tokensTotal: 0, tokensDone: 0 },
    });
  });

  const tokenResult = tokensEnabled
    ? await scanTokens(tokenCollectionIds, (done, total) => {
        postToUi({
          type: "scan-progress",
          progress: {
            phase: "tokens",
            componentsTotal: componentResult.scanned,
            componentsDone: componentResult.scanned,
            tokensTotal: total,
            tokensDone: done,
          },
        });
      })
    : { tokens: [], collections: [], scanned: 0, skipped: [] };

  postToUi({
    type: "scan-progress",
    progress: {
      phase: "done",
      componentsTotal: componentResult.scanned,
      componentsDone: componentResult.scanned,
      tokensTotal: tokenResult.scanned,
      tokensDone: tokenResult.scanned,
    },
  });

  return {
    snapshot: {
      components: componentResult.components,
      tokens: tokenResult.tokens,
      collections: tokenResult.collections,
    },
    scanSummary: {
      componentsScanned: componentResult.scanned,
      componentsSkipped: componentResult.skipped.length,
      tokensScanned: tokenResult.scanned,
      tokensSkipped: tokenResult.skipped.length,
      skippedItems: [...componentResult.skipped, ...tokenResult.skipped],
    },
  };
}

async function handleMessage(message: UiToPluginMessage): Promise<void> {
  await ensureProject();

  switch (message.type) {
    case "ui-ready":
    case "get-state": {
      postToUi({ type: "state", project });
      return;
    }

    case "discover-components": {
      const components = await discoverComponents(message.scope, message.pageIds);
      postToUi({ type: "discovered-components", components });
      return;
    }

    case "create-baseline": {
      const { snapshot, scanSummary } = await captureSnapshot(
        message.tracking.components.includedIds,
        message.tracking.tokens.includedCollectionIds,
        message.tracking.tokens.enabled,
      );

      const baseline: Baseline = {
        id: generateId("baseline"),
        name: message.name,
        version: message.version,
        description: message.description,
        tracking: message.tracking,
        snapshot,
        createdAt: new Date().toISOString(),
      };

      project.baselines.push(baseline);
      project.currentBaselineId = baseline.id;

      const changeSet = diffSnapshots(
        baseline.id,
        { components: [], tokens: [], collections: [] },
        snapshot,
        scanSummary,
      );
      project.changeSets.push(changeSet);

      await persist();
      postToUi({ type: "baseline-created", baseline });
      postToUi({ type: "state", project });
      return;
    }

    case "scan": {
      const baseline = findCurrentBaseline();
      if (!baseline) {
        postToUi({ type: "error", message: "No baseline exists yet. Create a baseline first." });
        return;
      }

      const { snapshot, scanSummary } = await captureSnapshot(
        await resolveComponentIds(baseline),
        baseline.tracking.tokens.includedCollectionIds,
        baseline.tracking.tokens.enabled,
      );

      const changeSet = diffSnapshots(baseline.id, baseline.snapshot, snapshot, scanSummary);
      project.changeSets.push(changeSet);

      // Stash the freshly scanned state on the baseline's tracking-config-compatible
      // shadow copy so "create release" can promote it without re-scanning.
      latestScannedSnapshot = snapshot;
      latestScanSummary = scanSummary;

      await persist();
      postToUi({ type: "scan-complete", changeSet });
      postToUi({ type: "state", project });
      return;
    }

    case "create-release": {
      const baseline = findCurrentBaseline();
      if (!baseline) {
        postToUi({ type: "error", message: "No baseline exists yet. Create a baseline first." });
        return;
      }

      const snapshot =
        latestScannedSnapshot ??
        (
          await captureSnapshot(
            await resolveComponentIds(baseline),
            baseline.tracking.tokens.includedCollectionIds,
            baseline.tracking.tokens.enabled,
          )
        ).snapshot;

      const changeSet = diffSnapshots(
        baseline.id,
        baseline.snapshot,
        snapshot,
        latestScanSummary ?? {
          componentsScanned: snapshot.components.length,
          componentsSkipped: 0,
          tokensScanned: snapshot.tokens.length,
          tokensSkipped: 0,
          skippedItems: [],
        },
      );
      project.changeSets.push(changeSet);

      const newBaseline: Baseline = {
        id: generateId("baseline"),
        name: baseline.name,
        version: message.version,
        description: baseline.description,
        tracking: baseline.tracking,
        snapshot,
        createdAt: new Date().toISOString(),
      };
      project.baselines.push(newBaseline);

      const changelogInput = {
        version: message.version,
        title: message.title,
        description: message.description,
        changes: changeSet.changes,
        include: message.include,
      };

      const release: Release = {
        id: generateId("release"),
        version: message.version,
        title: message.title,
        description: message.description,
        baselineId: newBaseline.id,
        previousBaselineId: baseline.id,
        changeSetId: changeSet.id,
        include: message.include,
        changelogMarkdown: generateMarkdown(changelogInput),
        changelogJson: JSON.stringify(generateJson(changelogInput), null, 2),
        createdAt: new Date().toISOString(),
      };

      project.releases.push(release);
      project.currentBaselineId = newBaseline.id;
      latestScannedSnapshot = undefined;
      latestScanSummary = undefined;

      await persist();
      postToUi({ type: "release-created", release });
      postToUi({ type: "state", project });
      return;
    }

    case "export": {
      const release = project.releases.find((r) => r.id === message.releaseId);
      if (!release) {
        postToUi({ type: "error", message: "Release not found." });
        return;
      }
      const content = message.format === "markdown" ? release.changelogMarkdown : release.changelogJson;
      postToUi({ type: "export-result", format: message.format, content, releaseId: release.id });
      return;
    }

    case "update-change": {
      const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
      const change = changeSet?.changes.find((c) => c.id === message.changeId);
      if (!change) {
        postToUi({ type: "error", message: "Change not found." });
        return;
      }
      if (message.reviewState !== undefined) change.reviewState = message.reviewState;
      if (message.reviewNote !== undefined) change.reviewNote = message.reviewNote;
      if (message.migrationNote !== undefined) change.migrationNote = message.migrationNote;
      if (message.manualClassification !== undefined) {
        change.manualClassification = message.manualClassification ?? undefined;
      }

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "bulk-update-review": {
      const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
      if (!changeSet) {
        postToUi({ type: "error", message: "Change set not found." });
        return;
      }
      const ids = new Set(message.changeIds);
      for (const change of changeSet.changes) {
        if (ids.has(change.id)) change.reviewState = message.reviewState;
      }

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "confirm-rename": {
      const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
      const addedChange = changeSet?.changes.find((c) => c.id === message.addedChangeId);
      const removedChange = changeSet?.changes.find((c) => c.id === message.removedChangeId);
      if (!changeSet || !addedChange || !removedChange) {
        postToUi({ type: "error", message: "Rename suggestion not found." });
        return;
      }

      const kind = addedChange.entityType === "token" ? "token" : "component";
      const renameEntry = {
        fromId: removedChange.entityId,
        fromName: removedChange.entityName,
        toId: addedChange.entityId,
        toName: addedChange.entityName,
        confirmedAt: new Date().toISOString(),
      };
      const existing = project.trackedEntities.find((e) => e.id === removedChange.entityId);
      if (existing) {
        existing.id = addedChange.entityId;
        existing.displayName = addedChange.entityName;
        existing.renameHistory.push(renameEntry);
      } else {
        const entity: TrackedEntity = {
          id: addedChange.entityId,
          kind,
          displayName: addedChange.entityName,
          deprecated: false,
          renameHistory: [renameEntry],
        };
        project.trackedEntities.push(entity);
      }

      // Fold the add+remove pair into a single "renamed" change rather than
      // silently deleting the audit trail (spec §13 — never silently merge).
      addedChange.changeType = kind === "token" ? "token-renamed" : "component-renamed";
      addedChange.category = "modified";
      addedChange.before = removedChange.entityName;
      addedChange.after = addedChange.entityName;
      addedChange.summary = `Renamed from "${removedChange.entityName}" to "${addedChange.entityName}" (id changed)`;
      addedChange.renameResolution = "confirmed";
      changeSet.changes = changeSet.changes.filter((c) => c.id !== removedChange.id);

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "dismiss-rename": {
      const changeSet = project.changeSets.find((cs) => cs.id === message.changeSetId);
      const addedChange = changeSet?.changes.find((c) => c.id === message.addedChangeId);
      const removedChange = changeSet?.changes.find((c) => c.id === message.removedChangeId);
      if (!changeSet || !addedChange || !removedChange) {
        postToUi({ type: "error", message: "Rename suggestion not found." });
        return;
      }
      addedChange.renameResolution = "dismissed";
      removedChange.renameResolution = "dismissed";

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "mark-deprecated": {
      const now = new Date().toISOString();
      const existing = project.trackedEntities.find((e) => e.id === message.entityId);
      if (existing) {
        existing.deprecated = true;
        existing.deprecatedAt = existing.deprecatedAt ?? now;
        existing.displayName = message.displayName;
        existing.replacement = message.replacement;
        existing.migrationNote = message.migrationNote;
      } else {
        const entity: TrackedEntity = {
          id: message.entityId,
          kind: message.kind,
          displayName: message.displayName,
          parentId: message.parentId,
          deprecated: true,
          deprecatedAt: now,
          replacement: message.replacement,
          migrationNote: message.migrationNote,
          renameHistory: [],
        };
        project.trackedEntities.push(entity);
      }

      const baseline = findCurrentBaseline();
      if (baseline) {
        const suffix = message.replacement ? ` — replaced by ${message.replacement}` : "";
        appendSyntheticChange(baseline.id, {
          id: generateId("change"),
          entityType: message.kind === "token" ? "token" : "component",
          entityId: message.entityId,
          entityName: message.displayName,
          category: "deprecated",
          severity: "info",
          changeType: `${message.kind}-deprecated`,
          summary: `Marked deprecated${suffix}`,
          breaking: false,
          potentialBreaking: false,
          reviewState: "unreviewed",
          migrationNote: message.migrationNote,
          createdAt: now,
        });
      }

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "unmark-deprecated": {
      const entity = project.trackedEntities.find((e) => e.id === message.entityId);
      if (!entity) {
        postToUi({ type: "error", message: "Tracked entity not found." });
        return;
      }
      entity.deprecated = false;
      entity.deprecatedAt = undefined;
      entity.replacement = undefined;
      entity.migrationNote = undefined;

      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "build-impact-index": {
      const index = await scanInstances((progress) => {
        postToUi({ type: "impact-index-progress", progress });
      });
      project.instanceIndex = index;

      await persist();
      postToUi({ type: "impact-index-complete", index });
      postToUi({ type: "state", project });
      return;
    }

    case "update-settings": {
      project.settings = message.settings;
      await persist();
      postToUi({ type: "state", project });
      return;
    }

    case "focus-node": {
      try {
        const node = await figma.getNodeByIdAsync(message.nodeId);
        if (node && "type" in node && node.type !== "DOCUMENT" && node.type !== "PAGE") {
          const sceneNode = node as SceneNode;
          const page = sceneNode.parent
            ? (function findPage(n: BaseNode | null): PageNode | undefined {
                let current = n;
                while (current) {
                  if (current.type === "PAGE") return current as PageNode;
                  current = current.parent;
                }
                return undefined;
              })(sceneNode)
            : undefined;
          if (page) {
            await figma.setCurrentPageAsync(page);
          }
          figma.currentPage.selection = [sceneNode];
          figma.viewport.scrollAndZoomIntoView([sceneNode]);
        }
      } catch {
        postToUi({ type: "error", message: "Could not locate that node — it may have been deleted." });
      }
      return;
    }

    default:
      return;
  }
}

figma.ui.onmessage = (message: UiToPluginMessage) => {
  handleMessage(message).catch((error) => {
    postToUi({
      type: "error",
      message: error instanceof Error ? error.message : "Unexpected error in DSLog plugin.",
    });
  });
};
