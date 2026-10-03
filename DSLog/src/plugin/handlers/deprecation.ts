import type { Change } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";
import { generateId } from "@shared/utils/id";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { postToUi } from "@plugin/utils/postMessage";
import { findCurrentBaseline, persist, session } from "./session";
import type { Msg } from "./types";

/**
 * Appends a manually-created Change (deprecation) to the current baseline's
 * most recent ChangeSet, creating an empty one first if a scan hasn't run
 * yet — so manual actions flow through the same changelog/history/dashboard
 * machinery as scanned changes, with no parallel counting logic.
 */
function appendSyntheticChange(baselineId: string, change: Change): void {
  let changeSet = getLatestChangeSetForBaseline(session.project, baselineId);
  if (!changeSet) {
    changeSet = {
      id: generateId("changeset"),
      baselineId,
      createdAt: new Date().toISOString(),
      changes: [],
      scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
    };
    session.project.changeSets.push(changeSet);
  }
  changeSet.changes.push(change);
}

export async function handleMarkDeprecated(message: Msg<"mark-deprecated">): Promise<void> {
  const { project } = session;
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
}

export async function handleUnmarkDeprecated(message: Msg<"unmark-deprecated">): Promise<void> {
  const { project } = session;
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
}
