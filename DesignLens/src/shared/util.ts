import type { Issue } from "./types";

/**
 * Stable identity for an issue across rescans, used as the key for persisted status
 * (resolved/ignored). Issue.id is a per-scan sequence number and isn't stable, so status
 * tracking keys off the rule + affected node instead.
 */
export function issueKey(issue: Pick<Issue, "ruleId"> & { node?: { id: string } }): string {
  return `${issue.ruleId}::${issue.node?.id ?? "file"}`;
}
