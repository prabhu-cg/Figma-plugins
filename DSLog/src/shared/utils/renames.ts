import type { Change, ChangeSet } from "@shared/types/change";

/**
 * Folds a confirmed rename's add + remove pair into one "renamed" change rather than silently deleting the audit
 * trail (spec §13 — never silently merge). Mutates `changeSet` and `added`; used both when the user confirms a
 * suggestion and when a re-scan re-applies a confirmation made earlier.
 */
export function foldConfirmedRename(changeSet: ChangeSet, added: Change, removed: Change): void {
  const kind = added.entityType === "token" ? "token" : "component";
  added.changeType = `${kind}-renamed`;
  added.category = "modified";
  added.before = removed.entityName;
  added.after = added.entityName;
  added.summary = `Renamed from "${removed.entityName}" to "${added.entityName}" (id changed)`;
  added.renameResolution = "confirmed";
  changeSet.changes = changeSet.changes.filter((c) => c.id !== removed.id);
}
