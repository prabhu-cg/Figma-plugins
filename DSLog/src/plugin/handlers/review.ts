import type { TrackedEntity } from "@shared/types/entity";
import { postToUi } from "@plugin/utils/postMessage";
import type { ChangePatch } from "@shared/types/messages";
import { applyChangePatches } from "@shared/utils/changePatches";
import { foldConfirmedRename } from "@shared/utils/renames";
import { persist, schedulePersist, session } from "./session";
import type { Msg } from "./types";

/**
 * Review edits are applied, announced to the UI as a small patch (not the whole project), and saved in the
 * background — so the UI updates immediately however large the project is.
 */
export async function handleUpdateChange(message: Msg<"update-change">): Promise<void> {
  const changeSet = session.project.changeSets.find((cs) => cs.id === message.changeSetId);
  if (!changeSet?.changes.some((c) => c.id === message.changeId)) {
    postToUi({ type: "error", message: "Change not found." });
    return;
  }
  const patch: ChangePatch = { changeId: message.changeId };
  if (message.reviewState !== undefined) patch.reviewState = message.reviewState;
  if (message.reviewNote !== undefined) patch.reviewNote = message.reviewNote;
  if (message.migrationNote !== undefined) patch.migrationNote = message.migrationNote;
  if (message.manualClassification !== undefined) patch.manualClassification = message.manualClassification;

  session.project = applyChangePatches(session.project, message.changeSetId, [patch]);
  postToUi({ type: "changes-updated", changeSetId: message.changeSetId, patches: [patch] });
  schedulePersist();
}

export async function handleBulkUpdateReview(message: Msg<"bulk-update-review">): Promise<void> {
  const changeSet = session.project.changeSets.find((cs) => cs.id === message.changeSetId);
  if (!changeSet) {
    postToUi({ type: "error", message: "Change set not found." });
    return;
  }
  const ids = new Set(message.changeIds);
  const patches: ChangePatch[] = changeSet.changes
    .filter((c) => ids.has(c.id))
    .map((c) => ({ changeId: c.id, reviewState: message.reviewState }));

  session.project = applyChangePatches(session.project, message.changeSetId, patches);
  postToUi({ type: "changes-updated", changeSetId: message.changeSetId, patches });
  schedulePersist();
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

  foldConfirmedRename(changeSet, addedChange, removedChange);

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
