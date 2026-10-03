import type { UiToPluginMessage } from "@shared/types/messages";
import type { Project } from "@shared/types/project";
import type { Msg } from "./types";
import { ensureProject, session } from "./session";
import { handleGetState, handleUpdateSettings } from "./state";
import { handleCreateBaseline, handleDiscoverComponents, handleScan } from "./scan";
import { handleCompareReleases, handleCreateRelease, handleExport } from "./release";
import { handleBulkUpdateReview, handleConfirmRename, handleDismissRename, handleUpdateChange } from "./review";
import { handleMarkDeprecated, handleUnmarkDeprecated } from "./deprecation";
import { handleBuildImpactIndex } from "./impact";
import { handleFocusNode } from "./focusNode";

type MessageType = UiToPluginMessage["type"];

/** One handler per UI message; the mapped type makes adding a message without a handler a compile error. */
const handlers: { [T in MessageType]: (message: Msg<T>) => Promise<void> } = {
  "ui-ready": handleGetState,
  "get-state": handleGetState,
  "discover-components": handleDiscoverComponents,
  "create-baseline": handleCreateBaseline,
  scan: handleScan,
  "create-release": handleCreateRelease,
  export: handleExport,
  "update-change": handleUpdateChange,
  "bulk-update-review": handleBulkUpdateReview,
  "mark-deprecated": handleMarkDeprecated,
  "unmark-deprecated": handleUnmarkDeprecated,
  "confirm-rename": handleConfirmRename,
  "dismiss-rename": handleDismissRename,
  "build-impact-index": handleBuildImpactIndex,
  "compare-releases": handleCompareReleases,
  "update-settings": handleUpdateSettings,
  "focus-node": handleFocusNode,
};

// Messages that never change `project`, so they skip the rollback backup below.
const READ_ONLY_MESSAGES: ReadonlySet<MessageType> = new Set([
  "ui-ready",
  "get-state",
  "discover-components",
  "export",
  "compare-releases",
  "focus-node",
]);

async function dispatch(message: UiToPluginMessage): Promise<void> {
  // Unknown types (e.g. from a newer/older UI build) are ignored rather than thrown on.
  const handler = handlers[message.type] as ((message: UiToPluginMessage) => Promise<void>) | undefined;
  if (handler) await handler(message);
}

/**
 * Handlers mutate `session.project` in memory and only then call persist(). If
 * anything throws (storage full, a scan error mid-way), the in-memory project would
 * keep changes that never reached storage and the UI would show state that vanishes
 * on reload. So back up before every mutating message and restore on failure.
 * JSON round-trip rather than structuredClone: the latter isn't available in
 * Figma's plugin sandbox, and Project is plain JSON (it's persisted as such).
 */
let queueTail: Promise<void> = Promise.resolve();

/**
 * Messages are handled strictly one at a time, in arrival order. Handlers mutate the shared project and then
 * await a save, so two running at once would interleave — one handler's rollback could undo the other's
 * changes, and two saves could overlap. (Pressing A then R quickly sends two messages back to back.)
 * Only `focus-node`, which just moves the canvas selection, skips the queue so it never waits behind a long scan.
 */
export function handleMessage(message: UiToPluginMessage): Promise<void> {
  if (message.type === "focus-node") return process(message);
  const run = queueTail.then(() => process(message));
  queueTail = run.catch(() => undefined);
  return run;
}

async function process(message: UiToPluginMessage): Promise<void> {
  await ensureProject();
  if (READ_ONLY_MESSAGES.has(message.type)) return dispatch(message);

  const backup = JSON.stringify(session.project);
  const backupSnapshot = session.latestScannedSnapshot;
  const backupSummary = session.latestScanSummary;
  try {
    await dispatch(message);
  } catch (error) {
    session.project = JSON.parse(backup) as Project;
    session.latestScannedSnapshot = backupSnapshot;
    session.latestScanSummary = backupSummary;
    throw error;
  }
}
