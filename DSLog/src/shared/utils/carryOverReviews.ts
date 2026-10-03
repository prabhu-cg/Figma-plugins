import type { Change, ChangeSet } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";
import { foldConfirmedRename } from "./renames";

export interface CarryOverResult {
  /** Review decisions (anything but "unreviewed") kept on changes that are unchanged since they were reviewed. */
  carried: number;
  /** Decisions reset because the same kind of change came back with different values. */
  reset: number;
}

/**
 * Every diff produces brand-new Change objects with fresh ids, so a re-scan would otherwise throw away all review
 * work. This copies it from the previous change set onto the new one, matching changes by what they *are*
 * (entity, change type, field) rather than by id:
 *
 *  - Same change, same values: the review state, notes, manual classification and a dismissed rename suggestion are
 *    all kept.
 *  - Same kind of change, different values (accepted "padding 12 → 16", then it became 20): the decision no longer
 *    applies, so it resets to "unreviewed" and the change is flagged `changedSinceReview`; the notes and manual
 *    classification are kept because they are the user's own text.
 *  - Confirmed renames (recorded in the tracked entities' rename history) are re-applied, since the diff reports the
 *    old and new entity as a fresh add + remove pair every time.
 *  - Manually-added deprecation entries, which no diff produces, are carried over while the entity is still deprecated.
 *
 * `next` must be a freshly created change set the caller owns: it is updated in place.
 */
export function carryOverReviews(
  next: ChangeSet,
  previous: ChangeSet | undefined,
  trackedEntities: TrackedEntity[],
): CarryOverResult {
  const result: CarryOverResult = { carried: 0, reset: 0 };

  reapplyConfirmedRenames(next, trackedEntities);
  if (!previous) return result;

  const previousByKey = groupByIdentity(previous.changes);
  const nextByKey = groupByIdentity(next.changes);

  for (const [key, added] of nextByKey) {
    const candidates = [...(previousByKey.get(key) ?? [])];
    if (candidates.length === 0) continue;

    // First pair up changes whose content is identical...
    const rest: Change[] = [];
    for (const change of added) {
      const content = contentOf(change);
      const index = candidates.findIndex((old) => contentOf(old) === content);
      if (index === -1) rest.push(change);
      else adopt(change, candidates.splice(index, 1)[0] as Change, true, result);
    }
    // ...then, only when it is unambiguous (as many left over on each side), pair the ones whose values moved on.
    if (rest.length > 0 && rest.length === candidates.length) {
      rest.forEach((change, i) => adopt(change, candidates[i] as Change, false, result));
    }
  }

  carryOverDeprecations(next, previous, trackedEntities, nextByKey, result);
  return result;
}

function identityOf(change: Change): string {
  return [change.entityType, change.entityId, change.changeType, change.field ?? ""].join("\u0000");
}

function contentOf(change: Change): string {
  return JSON.stringify([change.summary, change.before ?? null, change.after ?? null, change.modeDetails ?? null]);
}

function groupByIdentity(changes: Change[]): Map<string, Change[]> {
  const groups = new Map<string, Change[]>();
  for (const change of changes) {
    const key = identityOf(change);
    const group = groups.get(key);
    if (group) group.push(change);
    else groups.set(key, [change]);
  }
  return groups;
}

function adopt(target: Change, old: Change, sameContent: boolean, result: CarryOverResult): void {
  if (old.reviewNote !== undefined) target.reviewNote = old.reviewNote;
  if (old.migrationNote !== undefined) target.migrationNote = old.migrationNote;
  if (old.manualClassification) target.manualClassification = { ...old.manualClassification };
  if (old.renameResolution === "dismissed") target.renameResolution = "dismissed";

  const reviewed = old.reviewState !== "unreviewed";
  if (sameContent) {
    target.reviewState = old.reviewState;
    if (old.changedSinceReview) target.changedSinceReview = true; // still waiting for a fresh look
    if (reviewed) result.carried++;
    return;
  }
  target.reviewState = "unreviewed";
  if (reviewed || old.changedSinceReview) target.changedSinceReview = true;
  if (reviewed) result.reset++;
}

/**
 * A rename the user confirmed is recorded on the tracked entity (`renameHistory`), and the diff reports it as
 * an add + remove pair again on every scan, so fold the pair into a "renamed" change again. A chain of renames
 * (A → B → C) is honoured end to end.
 */
function reapplyConfirmedRenames(next: ChangeSet, trackedEntities: TrackedEntity[]): void {
  const confirmed = new Set<string>();
  for (const entity of trackedEntities) {
    const chain: string[] = [];
    for (const entry of entity.renameHistory) {
      if (chain.length === 0) chain.push(entry.fromId);
      chain.push(entry.toId);
    }
    for (let i = 0; i < chain.length; i++) {
      for (let j = i + 1; j < chain.length; j++) confirmed.add(`${chain[i]}\u0000${chain[j]}`);
    }
  }
  if (confirmed.size === 0) return;

  const byId = new Map(next.changes.map((c) => [c.id, c]));
  for (const added of [...next.changes]) {
    if (!added.possibleRenameOf || added.renameResolution) continue;
    const removed = byId.get(added.possibleRenameOf);
    if (removed && confirmed.has(`${removed.entityId}\u0000${added.entityId}`)) foldConfirmedRename(next, added, removed);
  }
}

/** Manual "mark deprecated" entries are added to a change set by hand, so a fresh diff never contains them. */
function carryOverDeprecations(
  next: ChangeSet,
  previous: ChangeSet,
  trackedEntities: TrackedEntity[],
  nextByKey: Map<string, Change[]>,
  result: CarryOverResult,
): void {
  for (const old of previous.changes) {
    if (old.category !== "deprecated" || !old.changeType.endsWith("-deprecated")) continue;
    if (nextByKey.has(identityOf(old))) continue;
    const entity = trackedEntities.find((e) => e.id === old.entityId);
    if (!entity?.deprecated) continue;
    next.changes.push({ ...old });
    if (old.reviewState !== "unreviewed") result.carried++;
  }
}
