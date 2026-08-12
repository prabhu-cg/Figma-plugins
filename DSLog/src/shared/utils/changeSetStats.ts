import type { Change } from "@shared/types/change";
import { getEffectiveClassification } from "./classification";

export interface ChangeSetStats {
  total: number;
  added: number;
  modified: number;
  removed: number;
  deprecated: number;
  breaking: number;
}

/**
 * Category + breaking-verdict counts for a list of changes, honoring any
 * manual classification override — the single place this is computed, used
 * by the Overview dashboard, release history rows, and release comparison.
 */
export function summarizeChanges(changes: Change[]): ChangeSetStats {
  const stats: ChangeSetStats = { total: changes.length, added: 0, modified: 0, removed: 0, deprecated: 0, breaking: 0 };
  for (const change of changes) {
    const effective = getEffectiveClassification(change);
    if (effective.category === "added") stats.added += 1;
    else if (effective.category === "modified") stats.modified += 1;
    else if (effective.category === "removed") stats.removed += 1;
    else if (effective.category === "deprecated") stats.deprecated += 1;
    if (effective.breaking) stats.breaking += 1;
  }
  return stats;
}
