import type { Baseline, Release } from "@shared/types/project";
import { generateId } from "@shared/utils/id";
import { diffSnapshots } from "@plugin/diff";
import { generateJson, generateMarkdown } from "@plugin/export";
import { postToUi } from "@plugin/utils/postMessage";
import { getLatestChangeSetForBaseline, pruneStaleChangeSets } from "@shared/utils/changeSets";
import { carryOverReviews } from "@shared/utils/carryOverReviews";
import { findCurrentBaseline, persist, session } from "./session";
import { captureSnapshot, resolveComponentIds } from "./scanSupport";
import type { Msg } from "./types";

export async function handleCreateRelease(message: Msg<"create-release">): Promise<void> {
  const { project } = session;
  const baseline = findCurrentBaseline();
  if (!baseline) {
    postToUi({ type: "error", message: "No baseline exists yet. Create a baseline first." });
    return;
  }

  const snapshot =
    session.latestScannedSnapshot ??
    (
      await captureSnapshot(
        await resolveComponentIds(baseline),
        baseline.tracking.tokens.includedCollectionIds,
        baseline.tracking.tokens.enabled,
      )
    ).snapshot;

  const previous = getLatestChangeSetForBaseline(project, baseline.id);
  const changeSet = diffSnapshots(
    baseline.id,
    baseline.snapshot,
    snapshot,
    session.latestScanSummary ?? {
      componentsScanned: snapshot.components.length,
      componentsSkipped: 0,
      tokensScanned: snapshot.tokens.length,
      tokensSkipped: 0,
      skippedItems: [],
    },
  );
  // The release is built from this fresh diff, so it has to inherit the reviews, migration notes and classification
  // overrides made on the scan being released — otherwise the changelog would never contain them.
  carryOverReviews(changeSet, previous, project.trackedEntities);
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
  session.latestScannedSnapshot = undefined;
  session.latestScanSummary = undefined;
  // The old baseline's scans are superseded; the release keeps its own change set as its permanent record.
  session.project = pruneStaleChangeSets(project);

  await persist();
  postToUi({ type: "release-created", release });
  postToUi({ type: "state", project: session.project });
}

export async function handleExport(message: Msg<"export">): Promise<void> {
  const { project } = session;
  const release = project.releases.find((r) => r.id === message.releaseId);
  if (!release) {
    postToUi({ type: "error", message: "Release not found." });
    return;
  }
  const content = message.format === "markdown" ? release.changelogMarkdown : release.changelogJson;
  postToUi({ type: "export-result", format: message.format, content, releaseId: release.id });
}

export async function handleCompareReleases(message: Msg<"compare-releases">): Promise<void> {
  const { project } = session;
  const releaseA = project.releases.find((r) => r.id === message.releaseIdA);
  const releaseB = project.releases.find((r) => r.id === message.releaseIdB);
  const baselineA = releaseA && project.baselines.find((b) => b.id === releaseA.baselineId);
  const baselineB = releaseB && project.baselines.find((b) => b.id === releaseB.baselineId);
  if (!baselineA || !baselineB) {
    postToUi({ type: "error", message: "Could not find both releases to compare." });
    return;
  }

  // Read-only report: reuses the same diffSnapshots a real scan uses,
  // fed two historical snapshots instead of baseline-vs-current. Never
  // pushed onto project.changeSets and never persisted — this is not a
  // scan, so it must not affect "what changed since the baseline".
  const changeSet = diffSnapshots(generateId("compare"), baselineA.snapshot, baselineB.snapshot, {
    componentsScanned: baselineB.snapshot.components.length,
    componentsSkipped: 0,
    tokensScanned: baselineB.snapshot.tokens.length,
    tokensSkipped: 0,
    skippedItems: [],
  });

  postToUi({
    type: "release-comparison-result",
    releaseIdA: message.releaseIdA,
    releaseIdB: message.releaseIdB,
    changeSet,
  });
}
