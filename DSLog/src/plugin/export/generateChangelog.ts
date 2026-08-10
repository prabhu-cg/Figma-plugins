import type { Change } from "@shared/types/change";
import type { Release } from "@shared/types/project";

export interface ChangelogInput {
  version: string;
  title: string;
  description?: string;
  changes: Change[];
  include: Release["include"];
}

export interface ChangelogJson {
  version: string;
  title: string;
  description?: string;
  generatedAt: string;
  summary: {
    added: number;
    changed: number;
    breaking: number;
  };
  added: Change[];
  changed: Change[];
  breaking: Change[];
  migration: Array<{ entityName: string; note: string }>;
}

function isBreakingSection(change: Change): boolean {
  return change.category === "removed" || change.breaking || change.potentialBreaking;
}

function filterByInclude(changes: Change[], include: ChangelogInput["include"]): Change[] {
  return changes.filter((change) => {
    if (change.entityType === "component" && !include.components) return false;
    if (change.entityType === "token" && !include.tokens) return false;
    return true;
  });
}

function groupByEntity(changes: Change[]): Map<string, Change[]> {
  const groups = new Map<string, Change[]>();
  for (const change of changes) {
    const key = change.entityType === "token" ? "Tokens" : change.entityName;
    const list = groups.get(key) ?? [];
    list.push(change);
    groups.set(key, list);
  }
  return groups;
}

function renderBullet(change: Change): string {
  const prefix = change.entityType === "token" ? `\`${change.entityName}\` — ` : "";
  const suffix = change.potentialBreaking && !change.breaking ? " (potential breaking change)" : "";
  return `- ${prefix}${change.summary}${suffix}`;
}

function renderSection(heading: string, changes: Change[]): string {
  if (changes.length === 0) return "";
  const groups = groupByEntity(changes);
  const lines: string[] = [`## ${heading}`, ""];
  for (const [entity, entityChanges] of groups) {
    lines.push(`### ${entity}`);
    for (const change of entityChanges) {
      lines.push(renderBullet(change));
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd() + "\n";
}

export function generateMarkdown(input: ChangelogInput): string {
  const filtered = filterByInclude(input.changes, input.include);

  const breaking = input.include.breakingChanges ? filtered.filter(isBreakingSection) : [];
  const breakingIds = new Set(breaking.map((c) => c.id));
  const added = filtered.filter((c) => c.category === "added" && !breakingIds.has(c.id));
  const changed = filtered.filter((c) => c.category === "modified" && !breakingIds.has(c.id));

  const parts: string[] = [`# Design System v${input.version}`, ""];
  if (input.title) parts.push(`**${input.title}**`, "");
  if (input.description) parts.push(input.description, "");

  parts.push(renderSection("Added", added));
  parts.push(renderSection("Changed", changed));
  parts.push(renderSection("Breaking Changes", breaking));

  if (input.include.migrationNotes) {
    const migrationNotes = filtered.filter((c) => c.migrationNote);
    if (migrationNotes.length > 0) {
      parts.push(`## Migration`, "");
      for (const change of migrationNotes) {
        parts.push(`- ${change.migrationNote}`);
      }
      parts.push("");
    }
  }

  return parts
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}

export function generateJson(input: ChangelogInput): ChangelogJson {
  const filtered = filterByInclude(input.changes, input.include);
  const breaking = input.include.breakingChanges ? filtered.filter(isBreakingSection) : [];
  const breakingIds = new Set(breaking.map((c) => c.id));
  const added = filtered.filter((c) => c.category === "added" && !breakingIds.has(c.id));
  const changed = filtered.filter((c) => c.category === "modified" && !breakingIds.has(c.id));
  const migration = input.include.migrationNotes
    ? filtered.filter((c) => c.migrationNote).map((c) => ({ entityName: c.entityName, note: c.migrationNote as string }))
    : [];

  return {
    version: input.version,
    title: input.title,
    description: input.description,
    generatedAt: new Date().toISOString(),
    summary: { added: added.length, changed: changed.length, breaking: breaking.length },
    added,
    changed,
    breaking,
    migration,
  };
}
