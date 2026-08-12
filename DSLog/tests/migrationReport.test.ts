import { describe, expect, it } from "vitest";
import { buildMigrationReport } from "@shared/utils/migrationReport";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";
import type { TrackedEntity } from "@shared/types/entity";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("buildMigrationReport", () => {
  it("includes a change with a migration note as a breaking-change item", () => {
    const change = classify(raw("component-removed"));
    change.migrationNote = "Use Button / XL instead.";
    const items = buildMigrationReport([change], []);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ entityId: "c1", source: "breaking-change", note: "Use Button / XL instead." });
  });

  it("omits changes without a migration note", () => {
    const change = classify(raw("component-removed"));
    expect(buildMigrationReport([change], [])).toHaveLength(0);
  });

  it("includes a deprecated entity with a replacement as a deprecation item", () => {
    const entity: TrackedEntity = {
      id: "comp-2",
      kind: "component",
      displayName: "Modal / OldSize",
      deprecated: true,
      replacement: "Modal / Width",
      renameHistory: [],
    };
    const items = buildMigrationReport([], [entity]);
    expect(items).toHaveLength(1);
    expect(items[0]?.note).toBe("Replace with Modal / Width");
    expect(items[0]?.source).toBe("deprecation");
  });

  it("appends the migration note to the replacement when both are present", () => {
    const entity: TrackedEntity = {
      id: "comp-2",
      kind: "component",
      displayName: "Modal / OldSize",
      deprecated: true,
      replacement: "Modal / Width",
      migrationNote: "Adjust padding after swapping.",
      renameHistory: [],
    };
    const items = buildMigrationReport([], [entity]);
    expect(items[0]?.note).toBe("Replace with Modal / Width — Adjust padding after swapping.");
  });

  it("omits a deprecated entity with neither a replacement nor a migration note", () => {
    const entity: TrackedEntity = { id: "comp-3", kind: "component", displayName: "Old", deprecated: true, renameHistory: [] };
    expect(buildMigrationReport([], [entity])).toHaveLength(0);
  });

  it("does not double-count an entity that is both a documented breaking change and deprecated", () => {
    const change = classify(raw("component-removed", { entityId: "comp-1" }));
    change.migrationNote = "Use the new one.";
    const entity: TrackedEntity = {
      id: "comp-1",
      kind: "component",
      displayName: "Button / Large",
      deprecated: true,
      replacement: "Button / XL",
      renameHistory: [],
    };
    const items = buildMigrationReport([change], [entity]);
    expect(items).toHaveLength(1);
    expect(items[0]?.source).toBe("breaking-change");
  });
});
