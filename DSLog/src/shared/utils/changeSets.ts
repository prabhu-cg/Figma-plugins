import type { ChangeSet } from "@shared/types/change";
import type { Project } from "@shared/types/project";

/** Most recently created ChangeSet diffed against a given baseline, if any. */
export function getLatestChangeSetForBaseline(project: Project, baselineId: string): ChangeSet | undefined {
  const sets = project.changeSets.filter((cs) => cs.baselineId === baselineId);
  if (sets.length === 0) return undefined;
  return sets.reduce((latest, cs) => (cs.createdAt > latest.createdAt ? cs : latest));
}
