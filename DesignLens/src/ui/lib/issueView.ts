import type { Issue, IssueStatus, Severity } from "@shared/types";
import { CATEGORY_LABELS } from "@shared/types";
import type { AuditCategory } from "@shared/types";

export interface FiltersState {
  search: string;
  category: AuditCategory | "all";
  severity: Severity | "all";
  componentId: string | "all";
  status: IssueStatus | "all";
  collection: string | "all";
}

export const DEFAULT_FILTERS: FiltersState = {
  search: "",
  category: "all",
  severity: "all",
  componentId: "all",
  status: "all",
  collection: "all"
};

export type SortKey = "severity" | "impact" | "module" | "component";

export const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "severity", label: "Severity" },
  { id: "impact", label: "Impact" },
  { id: "module", label: "Module" },
  { id: "component", label: "Component" }
];

const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, suggestion: 2 };
const LEVEL_RANK = { high: 0, medium: 1, low: 2 } as const;

export function filterIssues(issues: Issue[], filters: FiltersState): Issue[] {
  const search = filters.search.trim().toLowerCase();
  return issues.filter((issue) => {
    if (filters.category !== "all" && issue.category !== filters.category) return false;
    if (filters.severity !== "all" && issue.severity !== filters.severity) return false;
    if (filters.componentId !== "all" && issue.node?.componentId !== filters.componentId) return false;
    if (filters.status !== "all" && issue.status !== filters.status) return false;
    if (filters.collection !== "all" && issue.collection !== filters.collection) return false;
    if (search) {
      const haystack = `${issue.title} ${issue.description} ${issue.node?.componentName ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function bySeverity(a: Issue, b: Issue): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || LEVEL_RANK[a.estimatedImpact] - LEVEL_RANK[b.estimatedImpact];
}

/** Returns a new array. Every ordering falls back to severity so ties are meaningful, and the sort is stable. */
export function sortIssues(issues: Issue[], key: SortKey): Issue[] {
  const compare: Record<SortKey, (a: Issue, b: Issue) => number> = {
    severity: bySeverity,
    impact: (a, b) => LEVEL_RANK[a.estimatedImpact] - LEVEL_RANK[b.estimatedImpact] || bySeverity(a, b),
    module: (a, b) => CATEGORY_LABELS[a.category].localeCompare(CATEGORY_LABELS[b.category]) || bySeverity(a, b),
    component: (a, b) =>
      (a.node?.componentName ?? "￿").localeCompare(b.node?.componentName ?? "￿") || bySeverity(a, b)
  };
  return [...issues].sort(compare[key]);
}

/** Issue counts per severity and per status, ignoring the filter being counted so option labels show what choosing them would yield. */
export function countFacets(issues: Issue[], filters: FiltersState) {
  const severity: Record<Severity, number> = { critical: 0, warning: 0, suggestion: 0 };
  const status: Record<IssueStatus, number> = { open: 0, resolved: 0, ignored: 0 };
  for (const issue of issues) {
    if (matchesExcept(issue, filters, "severity")) severity[issue.severity] += 1;
    if (matchesExcept(issue, filters, "status")) status[issue.status] += 1;
  }
  return { severity, status };
}

function matchesExcept(issue: Issue, filters: FiltersState, skip: "severity" | "status"): boolean {
  return filterIssues([issue], { ...filters, [skip]: "all" }).length === 1;
}

/** Index to select after a j/k/arrow move; clamps at both ends and starts at the edge when nothing is selected. */
export function stepSelection(ids: string[], currentId: string | null, delta: 1 | -1): string | null {
  if (ids.length === 0) return null;
  const index = currentId === null ? -1 : ids.indexOf(currentId);
  if (index === -1) return ids[delta === 1 ? 0 : ids.length - 1];
  return ids[Math.max(0, Math.min(ids.length - 1, index + delta))];
}
