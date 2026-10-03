import type { ChangeSet } from "@shared/types/change";
import type { Project } from "@shared/types/project";

/** Most recently created ChangeSet diffed against a given baseline, if any. */
export function getLatestChangeSetForBaseline(project: Project, baselineId: string): ChangeSet | undefined {
  const sets = project.changeSets.filter((cs) => cs.baselineId === baselineId);
  if (sets.length === 0) return undefined;
  return sets.reduce((latest, cs) => (cs.createdAt > latest.createdAt ? cs : latest));
}

/**
 * Change sets worth keeping: the latest one for the current baseline (what the Changes page shows and the next
 * release is built from) and any set a release points at (its permanent record). Every other set is a
 * superseded scan — a stale copy of the same diff with different change ids — and only costs storage and
 * duplicates entries in History and search.
 */
export function pruneStaleChangeSets(project: Project): Project {
  const keep = new Set<string>();
  for (const release of project.releases) keep.add(release.changeSetId);
  const current = project.currentBaselineId ? getLatestChangeSetForBaseline(project, project.currentBaselineId) : undefined;
  if (current) keep.add(current.id);

  const changeSets = project.changeSets.filter((cs) => keep.has(cs.id));
  return changeSets.length === project.changeSets.length ? project : { ...project, changeSets };
}
