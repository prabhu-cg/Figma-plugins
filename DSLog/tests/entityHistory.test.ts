import { describe, expect, it } from "vitest";
import { getEntityHistory, getEntityIdChain } from "@shared/utils/entityHistory";
import { createEmptyProject } from "@shared/types/project";
import type { Project } from "@shared/types/project";
import type { Change } from "@shared/types/change";

function makeChange(overrides: Partial<Change> = {}): Change {
  return {
    id: `change-${Math.random()}`,
    entityType: "component",
    entityId: "comp-1",
    entityName: "Button",
    category: "modified",
    severity: "minor",
    changeType: "property-changed",
    summary: "Changed something",
    breaking: false,
    potentialBreaking: false,
    reviewState: "unreviewed",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function baseProject(): Project {
  return createEmptyProject(2);
}

describe("getEntityIdChain", () => {
  it("returns just the given id when no rename history exists", () => {
    const project = baseProject();
    expect(getEntityIdChain(project, "comp-1")).toEqual(["comp-1"]);
  });

  it("includes every prior id recorded in the tracked entity's rename history", () => {
    const project = baseProject();
    project.trackedEntities.push({
      id: "comp-3",
      kind: "component",
      displayName: "Button",
      deprecated: false,
      renameHistory: [
        { fromId: "comp-1", fromName: "Btn", toId: "comp-2", toName: "Button Old", confirmedAt: "2026-01-01" },
        { fromId: "comp-2", fromName: "Button Old", toId: "comp-3", toName: "Button", confirmedAt: "2026-02-01" },
      ],
    });
    const chain = getEntityIdChain(project, "comp-3");
    expect(new Set(chain)).toEqual(new Set(["comp-1", "comp-2", "comp-3"]));
  });
});

describe("getEntityHistory", () => {
  it("groups changes by the release they were folded into, newest first", () => {
    const project = baseProject();
    project.changeSets.push(
      { id: "cs-1", baselineId: "b1", createdAt: "2026-01-01T00:00:00Z", changes: [makeChange({ id: "c1" })], scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] } },
      { id: "cs-2", baselineId: "b2", createdAt: "2026-02-01T00:00:00Z", changes: [makeChange({ id: "c2" })], scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] } },
    );
    project.releases.push(
      { id: "r1", version: "1.0.0", title: "First", baselineId: "b1", changeSetId: "cs-1", include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true }, changelogMarkdown: "", changelogJson: "", createdAt: "2026-01-02T00:00:00Z" },
      { id: "r2", version: "2.0.0", title: "Second", baselineId: "b2", changeSetId: "cs-2", include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true }, changelogMarkdown: "", changelogJson: "", createdAt: "2026-02-02T00:00:00Z" },
    );

    const history = getEntityHistory(project, "comp-1");
    expect(history).toHaveLength(2);
    expect(history[0]?.release?.version).toBe("2.0.0");
    expect(history[1]?.release?.version).toBe("1.0.0");
  });

  it("buckets changes from a changeSet with no matching release under 'Unreleased' (release: undefined), sorted first", () => {
    const project = baseProject();
    project.changeSets.push(
      { id: "cs-released", baselineId: "b1", createdAt: "2026-01-01T00:00:00Z", changes: [makeChange({ id: "c1" })], scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] } },
      { id: "cs-unreleased", baselineId: "b2", createdAt: "2026-03-01T00:00:00Z", changes: [makeChange({ id: "c2" })], scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] } },
    );
    project.releases.push({
      id: "r1",
      version: "1.0.0",
      title: "First",
      baselineId: "b1",
      changeSetId: "cs-released",
      include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
      changelogMarkdown: "",
      changelogJson: "",
      createdAt: "2026-01-02T00:00:00Z",
    });

    const history = getEntityHistory(project, "comp-1");
    expect(history).toHaveLength(2);
    expect(history[0]?.release).toBeUndefined();
    expect(history[1]?.release?.version).toBe("1.0.0");
  });

  it("follows the rename chain so changes recorded against a prior id still appear in the current id's history", () => {
    const project = baseProject();
    project.trackedEntities.push({
      id: "comp-2",
      kind: "component",
      displayName: "Button",
      deprecated: false,
      renameHistory: [{ fromId: "comp-1", fromName: "Btn", toId: "comp-2", toName: "Button", confirmedAt: "2026-01-15" }],
    });
    project.changeSets.push({
      id: "cs-1",
      baselineId: "b1",
      createdAt: "2026-01-01T00:00:00Z",
      changes: [makeChange({ id: "c1", entityId: "comp-1" })],
      scanSummary: { componentsScanned: 0, componentsSkipped: 0, tokensScanned: 0, tokensSkipped: 0, skippedItems: [] },
    });

    const history = getEntityHistory(project, "comp-2");
    expect(history).toHaveLength(1);
    expect(history[0]?.changes[0]?.entityId).toBe("comp-1");
  });
});
