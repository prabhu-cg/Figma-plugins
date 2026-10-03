import type { Change, ChangeSet } from "@shared/types/change";
import type { Baseline, Project, Release } from "@shared/types/project";
import { createEmptyProject } from "@shared/types/project";

export function makeChange(id: string, overrides: Partial<Change> = {}): Change {
  return {
    id,
    entityType: "component",
    entityId: `entity-${id}`,
    entityName: `Component ${id}`,
    category: "modified",
    severity: "minor",
    changeType: "property-changed",
    summary: `Padding changed on ${id}`,
    breaking: false,
    potentialBreaking: false,
    reviewState: "unreviewed",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeBaseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    id: "baseline-1",
    name: "Design System",
    version: "1.0.0",
    tracking: {
      components: { scope: "document", includedIds: [], pageIds: [] },
      tokens: { enabled: true, includedCollectionIds: [] },
    },
    snapshot: { components: [], tokens: [], collections: [] },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeRelease(overrides: Partial<Release> = {}): Release {
  return {
    id: "release-1",
    version: "1.1.0",
    title: "First release",
    baselineId: "baseline-2",
    changeSetId: "changeset-1",
    include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
    changelogMarkdown: "# 1.1.0",
    changelogJson: "{}",
    createdAt: "2026-02-01T00:00:00.000Z",
    ...overrides,
  };
}

/** A project with one baseline and one change set holding `changes`. */
export function makeProject(changes: Change[] = [], overrides: Partial<Project> = {}): Project {
  const project = createEmptyProject(2);
  const baseline = makeBaseline();
  const changeSet: ChangeSet = {
    id: "changeset-1",
    baselineId: baseline.id,
    createdAt: "2026-01-02T00:00:00.000Z",
    changes,
    scanSummary: { componentsScanned: changes.length, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
  };
  return { ...project, baselines: [baseline], currentBaselineId: baseline.id, changeSets: [changeSet], ...overrides };
}
