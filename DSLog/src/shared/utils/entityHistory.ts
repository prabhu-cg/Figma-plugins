import type { Project, Release } from "@shared/types/project";
import type { Change } from "@shared/types/change";

export interface EntityHistoryGroup {
  /** undefined = changes not yet folded into a release ("Unreleased"). */
  release: Release | undefined;
  changes: Change[];
}

/**
 * Every id this logical entity has ever had. A TrackedEntity's id is always
 * its *current* id, and each confirmed rename (spec §13) appends the prior
 * id to that same record's renameHistory — so one lookup by current id
 * already carries the full chain, however many renames deep.
 */
export function getEntityIdChain(project: Project, entityId: string): string[] {
  const ids = new Set<string>([entityId]);
  const tracked = project.trackedEntities.find((e) => e.id === entityId);
  if (tracked) {
    for (const entry of tracked.renameHistory) ids.add(entry.fromId);
  }
  return Array.from(ids);
}

/**
 * Chronological (newest first) history of every Change recorded against an
 * entity, across every release it's been part of — the data behind the
 * Component/Token History screens (spec §4/§5) and the Releases screen's
 * per-release change list (spec §3).
 */
export function getEntityHistory(project: Project, entityId: string): EntityHistoryGroup[] {
  const idChain = new Set(getEntityIdChain(project, entityId));
  const groups = new Map<string, EntityHistoryGroup>();
  const UNRELEASED_KEY = "__unreleased__";

  for (const changeSet of project.changeSets) {
    const relevantChanges = changeSet.changes.filter((c) => idChain.has(c.entityId));
    if (relevantChanges.length === 0) continue;
    const release = project.releases.find((r) => r.changeSetId === changeSet.id);
    const key = release?.id ?? UNRELEASED_KEY;
    const group = groups.get(key) ?? { release, changes: [] };
    group.changes.push(...relevantChanges);
    groups.set(key, group);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (!a.release) return -1;
    if (!b.release) return 1;
    return b.release.createdAt.localeCompare(a.release.createdAt);
  });
}
