import type { Issue } from "./types";

/**
 * Stable identity for an issue across rescans, used as the key for persisted status
 * (resolved/ignored). Issue.id is a per-scan sequence number and isn't stable, so status
 * tracking keys off the rule + affected node + an optional discriminator instead. The
 * discriminator keeps several findings from one rule on the same node (fill vs stroke,
 * each padding side) and node-less findings (one per variable/style) from sharing a key.
 */
export function issueKey(issue: Pick<Issue, "ruleId" | "discriminator"> & { node?: { id: string } }): string {
  const base = `${issue.ruleId}::${issue.node?.id ?? "file"}`;
  return issue.discriminator ? `${base}::${issue.discriminator}` : base;
}
