import { describe, expect, it } from "vitest";
import { buildSearchIndex, searchIndex } from "@shared/utils/search";
import { createEmptyProject } from "@shared/types/project";
import type { Project } from "@shared/types/project";

function projectWithData(): Project {
  const project = createEmptyProject(2);
  project.currentBaselineId = "b1";
  project.baselines.push({
    id: "b1",
    name: "Design System",
    version: "1.0.0",
    tracking: {
      components: { scope: "document", includedIds: [], pageIds: [] },
      tokens: { enabled: true, includedCollectionIds: [] },
    },
    snapshot: {
      components: [
        {
          identity: { id: "comp-1", name: "Button", remote: false },
          metadata: {},
          properties: [],
          variants: [],
          structure: { key: "root/0:Button", name: "Button", type: "COMPONENT", visible: true, children: [] },
          tokens: [],
          styles: [],
          dimensions: {},
          hash: "h1",
          capturedAt: "2026-01-01T00:00:00Z",
        },
      ],
      tokens: [
        {
          id: "token-1",
          name: "spacing.300",
          collectionId: "coll-1",
          collectionName: "Primitives",
          type: "FLOAT",
          scopes: [],
          remote: false,
          valuesByMode: [],
          hash: "h2",
          capturedAt: "2026-01-01T00:00:00Z",
        },
      ],
      collections: [],
    },
    createdAt: "2026-01-01T00:00:00Z",
  });
  project.releases.push({
    id: "r1",
    version: "1.0.0",
    title: "First release",
    baselineId: "b1",
    changeSetId: "cs-1",
    include: { components: true, tokens: true, breakingChanges: true, migrationNotes: true },
    changelogMarkdown: "",
    changelogJson: "",
    createdAt: "2026-01-01T00:00:00Z",
  });
  project.changeSets.push({
    id: "cs-1",
    baselineId: "b1",
    createdAt: "2026-01-01T00:00:00Z",
    changes: [
      {
        id: "change-1",
        entityType: "component",
        entityId: "comp-1",
        entityName: "Button",
        category: "added",
        severity: "info",
        changeType: "component-added",
        summary: "Component added",
        breaking: false,
        potentialBreaking: false,
        reviewState: "unreviewed",
        createdAt: "2026-01-01T00:00:00Z",
      },
    ],
    scanSummary: { componentsScanned: 1, componentsSkipped: 0, tokensScanned: 1, tokensSkipped: 0, skippedItems: [] },
  });
  project.trackedEntities.push({
    id: "comp-2",
    kind: "component",
    displayName: "Legacy Button",
    deprecated: true,
    deprecatedAt: "2026-01-05T00:00:00Z",
    renameHistory: [],
  });
  return project;
}

describe("search", () => {
  it("indexes components, tokens, releases, changes, and deprecated entities with their type", () => {
    const index = buildSearchIndex(projectWithData());
    const types = new Set(index.map((r) => r.type));
    expect(types).toEqual(new Set(["component", "token", "release", "change", "deprecated"]));
  });

  it("matches substrings case-insensitively against label or sublabel", () => {
    const index = buildSearchIndex(projectWithData());
    expect(searchIndex(index, "BUTTON").some((r) => r.type === "component")).toBe(true);
    expect(searchIndex(index, "primitives").some((r) => r.type === "token")).toBe(true);
    expect(searchIndex(index, "legacy").some((r) => r.type === "deprecated")).toBe(true);
  });

  it("returns nothing for an empty query", () => {
    const index = buildSearchIndex(projectWithData());
    expect(searchIndex(index, "  ")).toEqual([]);
  });
});
