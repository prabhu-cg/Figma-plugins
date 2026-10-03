import type { Baseline } from "@shared/types/project";
import { generateId } from "@shared/utils/id";
import { discoverComponents } from "@plugin/scanner";
import { diffSnapshots } from "@plugin/diff";
import { postToUi } from "@plugin/utils/postMessage";
import { getLatestChangeSetForBaseline, pruneStaleChangeSets } from "@shared/utils/changeSets";
import { carryOverReviews } from "@shared/utils/carryOverReviews";
import { findCurrentBaseline, persist, session } from "./session";
import { captureSnapshot, resolveComponentIds } from "./scanSupport";
import type { Msg } from "./types";

export async function handleDiscoverComponents(message: Msg<"discover-components">): Promise<void> {
  const components = await discoverComponents(message.scope, message.pageIds);
  postToUi({ type: "discovered-components", components });
}

export async function handleCreateBaseline(message: Msg<"create-baseline">): Promise<void> {
  const { project } = session;
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
  session.project = pruneStaleChangeSets(project);

  await persist();
  postToUi({ type: "baseline-created", baseline });
  postToUi({ type: "state", project: session.project });
}

export async function handleScan(message: Msg<"scan">): Promise<void> {
  const { project } = session;
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

  const previous = getLatestChangeSetForBaseline(project, baseline.id);
  const changeSet = diffSnapshots(baseline.id, baseline.snapshot, snapshot, scanSummary);
  // A re-scan must not throw away the review work done on the previous one.
  const { carried, reset } = carryOverReviews(changeSet, previous, project.trackedEntities);
  project.changeSets.push(changeSet);

  // Stash the freshly scanned state on the baseline's tracking-config-compatible
  // shadow copy so "create release" can promote it without re-scanning.
  session.latestScannedSnapshot = snapshot;
  session.latestScanSummary = scanSummary;
  // Earlier scans of this baseline are superseded by this one.
  session.project = pruneStaleChangeSets(project);

  await persist();
  postToUi({ type: "scan-complete", changeSet, reviewsKept: carried, reviewsReset: reset });
  postToUi({ type: "state", project: session.project });
}
