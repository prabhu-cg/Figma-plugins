import { describe, expect, it } from "vitest";
import { isValidProject, migrateProject } from "@shared/schemas/validate";
import { createEmptyProject } from "@shared/types/project";
import { STORAGE_SCHEMA_VERSION } from "@shared/constants/storage";

describe("isValidProject", () => {
  it("accepts a well-formed empty project", () => {
    expect(isValidProject(createEmptyProject(STORAGE_SCHEMA_VERSION))).toBe(true);
  });

  it("rejects null", () => {
    expect(isValidProject(null)).toBe(false);
  });

  it("rejects a string (e.g. truncated JSON parsed to a primitive)", () => {
    expect(isValidProject("not-an-object")).toBe(false);
  });

  it("rejects an object missing required arrays", () => {
    expect(isValidProject({ schemaVersion: 1, settings: {} })).toBe(false);
  });

  it("rejects an object where baselines is not an array", () => {
    expect(
      isValidProject({ schemaVersion: 1, baselines: "oops", releases: [], changeSets: [], settings: {} }),
    ).toBe(false);
  });
});

describe("migrateProject", () => {
  it("returns an empty project for garbage input", () => {
    const migrated = migrateProject({ garbage: true });
    expect(migrated.baselines).toEqual([]);
    expect(migrated.schemaVersion).toBe(STORAGE_SCHEMA_VERSION);
  });

  it("returns an empty project for a malformed/corrupted blob", () => {
    const migrated = migrateProject(undefined);
    expect(migrated).toEqual(createEmptyProject(STORAGE_SCHEMA_VERSION));
  });

  it("backfills missing arrays on a partially-corrupted but valid-shaped project", () => {
    const migrated = migrateProject({
      schemaVersion: 1,
      baselines: [{ id: "b1" }],
      releases: "not-an-array",
      changeSets: [],
      settings: { tracking: { components: true, tokens: true } },
    });
    expect(migrated.baselines).toHaveLength(1);
    expect(migrated.releases).toEqual([]);
  });

  it("preserves valid data unchanged", () => {
    const project = createEmptyProject(STORAGE_SCHEMA_VERSION);
    project.currentBaselineId = "b1";
    const migrated = migrateProject(project);
    expect(migrated.currentBaselineId).toBe("b1");
  });
});
