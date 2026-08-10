import type { UiToPluginMessage } from "@shared/types/messages";
import type { Baseline, DesignSystemSnapshot, Project, Release } from "@shared/types/project";
import { generateId } from "@shared/utils/id";
import { loadProject, saveProject } from "@plugin/storage";
import { discoverComponents, scanComponents, scanTokens } from "@plugin/scanner";
import { diffSnapshots } from "@plugin/diff";
import { generateJson, generateMarkdown } from "@plugin/export";
import { postToUi } from "@plugin/utils/postMessage";

figma.showUI(__html__, { width: 420, height: 640, themeColors: true });

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
        baseline.tracking.components.includedIds,
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
            baseline.tracking.components.includedIds,
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
      if (message.reviewed !== undefined) change.reviewed = message.reviewed;
      if (message.reviewNote !== undefined) change.reviewNote = message.reviewNote;
      if (message.migrationNote !== undefined) change.migrationNote = message.migrationNote;

      await persist();
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
