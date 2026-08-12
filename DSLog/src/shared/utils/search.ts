import type { Project } from "@shared/types/project";

export type SearchResultType = "component" | "token" | "release" | "change" | "deprecated";

export interface SearchResult {
  type: SearchResultType;
  id: string;
  label: string;
  sublabel?: string;
}

/**
 * Flat, deterministic search index over everything a user might look for
 * (spec §16: component, token, release, change, deprecated item) — no
 * fuzzy/AI matching, just substring search over label/sublabel, consistent
 * with the product's "no AI" constraint.
 */
export function buildSearchIndex(project: Project): SearchResult[] {
  const results: SearchResult[] = [];
  const baseline = project.baselines.find((b) => b.id === project.currentBaselineId);

  for (const component of baseline?.snapshot.components ?? []) {
    results.push({
      type: "component",
      id: component.identity.id,
      label: component.identity.name,
      sublabel: component.identity.componentSetName,
    });
  }

  for (const token of baseline?.snapshot.tokens ?? []) {
    results.push({ type: "token", id: token.id, label: token.name, sublabel: token.collectionName });
  }

  for (const release of project.releases) {
    results.push({ type: "release", id: release.id, label: `v${release.version}`, sublabel: release.title });
  }

  for (const changeSet of project.changeSets) {
    for (const change of changeSet.changes) {
      results.push({ type: "change", id: change.id, label: change.entityName, sublabel: change.summary });
    }
  }

  for (const entity of project.trackedEntities) {
    if (entity.deprecated) results.push({ type: "deprecated", id: entity.id, label: entity.displayName, sublabel: "Deprecated" });
  }

  return results;
}

export function searchIndex(index: SearchResult[], query: string, limit = 60): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return index
    .filter((r) => r.label.toLowerCase().includes(q) || (r.sublabel ?? "").toLowerCase().includes(q))
    .slice(0, limit);
}

export const SEARCH_GROUP_ORDER: SearchResultType[] = ["component", "token", "release", "change", "deprecated"];

export interface SearchResultGroup {
  type: SearchResultType;
  items: SearchResult[];
  /** Total matches of this type before the per-group limit was applied. */
  totalCount: number;
}

/**
 * Groups flat search results by entity type and caps each group
 * independently, so one noisy type (e.g. a dozen Changes matching a
 * component's own name) can't crowd out every other kind of result.
 */
export function groupSearchResults(results: SearchResult[], perGroupLimit = 5): SearchResultGroup[] {
  return SEARCH_GROUP_ORDER.map((type) => {
    const items = results.filter((r) => r.type === type);
    return { type, items: items.slice(0, perGroupLimit), totalCount: items.length };
  }).filter((group) => group.items.length > 0);
}
