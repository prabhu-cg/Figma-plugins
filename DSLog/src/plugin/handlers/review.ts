import type { TrackedEntity } from "@shared/types/entity";
import { postToUi } from "@plugin/utils/postMessage";
import { persist, session } from "./session";
import type { Msg } from "./types";

export async function handleUpdateChange(message: Msg<"update-change">): Promise<void> {
  const { project } = session;
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
}

export async function handleBulkUpdateReview(message: Msg<"bulk-update-review">): Promise<void> {
  const { project } = session;
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
}

export async function handleConfirmRename(message: Msg<"confirm-rename">): Promise<void> {
  const { project } = session;
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
}

export async function handleDismissRename(message: Msg<"dismiss-rename">): Promise<void> {
  const { project } = session;
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
}
