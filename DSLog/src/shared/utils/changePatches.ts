import type { Change, ChangeSet } from "@shared/types/change";
import type { ChangePatch } from "@shared/types/messages";
import type { Project } from "@shared/types/project";

function applyPatch(change: Change, patch: ChangePatch): Change {
  const next: Change = { ...change };
  if (patch.reviewState !== undefined) {
    next.reviewState = patch.reviewState;
    delete next.changedSinceReview; // a fresh decision answers "changed since you reviewed it"
  }
  if (patch.reviewNote !== undefined) next.reviewNote = patch.reviewNote;
  if (patch.migrationNote !== undefined) next.migrationNote = patch.migrationNote;
  if (patch.manualClassification !== undefined) next.manualClassification = patch.manualClassification ?? undefined;
  return next;
}

/**
 * Applies review edits to one change set without mutating anything: only the edited changes get new objects, so
 * everything else keeps its identity (which is what lets the UI skip re-rendering untouched rows). The plugin
 * and the UI both use this, so they cannot disagree about what a patch means.
 */
export function applyChangePatches(project: Project, changeSetId: string, patches: ChangePatch[]): Project {
  if (patches.length === 0) return project;
  const index = project.changeSets.findIndex((cs) => cs.id === changeSetId);
  const changeSet = project.changeSets[index];
  if (index === -1 || !changeSet) return project;

  const byId = new Map(patches.map((patch) => [patch.changeId, patch]));
  let touched = false;
  const changes = changeSet.changes.map((change) => {
    const patch = byId.get(change.id);
    if (!patch) return change;
    touched = true;
    return applyPatch(change, patch);
  });
  if (!touched) return project;

  const nextSet: ChangeSet = { ...changeSet, changes };
  const changeSets = project.changeSets.slice();
  changeSets[index] = nextSet;
  return { ...project, changeSets };
}
