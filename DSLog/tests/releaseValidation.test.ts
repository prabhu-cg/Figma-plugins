import { describe, expect, it } from "vitest";
import { hasBlockingIssues, validateRelease } from "@shared/utils/releaseValidation";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";
import type { TrackedEntity } from "@shared/types/entity";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("validateRelease", () => {
  it("blocks on an invalid version and does not block on anything else being wrong at the same time", () => {
    const checks = validateRelease({ version: "not-a-version", existingVersions: [], changes: [], trackedEntities: [] });
    const versionCheck = checks.find((c) => c.id === "version-valid");
    expect(versionCheck?.status).toBe("blocking");
    expect(hasBlockingIssues(checks)).toBe(true);
  });

  it("blocks on a duplicate version", () => {
    const checks = validateRelease({
      version: "2.4.0",
      existingVersions: ["2.4.0"],
      changes: [],
      trackedEntities: [],
    });
    expect(checks.find((c) => c.id === "version-unique")?.status).toBe("blocking");
  });

  it("warns (does not block) on unreviewed changes", () => {
    const change = classify(raw("component-added"));
    expect(change.reviewState).toBe("unreviewed");
    const checks = validateRelease({ version: "2.4.0", existingVersions: [], changes: [change], trackedEntities: [] });
    const reviewCheck = checks.find((c) => c.id === "changes-reviewed");
    expect(reviewCheck?.status).toBe("warning");
    expect(hasBlockingIssues(checks)).toBe(false);
  });

  it("warns on a breaking change with no migration note", () => {
    const change = classify(raw("component-removed"));
    const checks = validateRelease({ version: "2.4.0", existingVersions: [], changes: [change], trackedEntities: [] });
    expect(checks.find((c) => c.id === "breaking-documented")?.status).toBe("warning");
  });

  it("passes the breaking-documented check once a migration note is present", () => {
    const change = classify(raw("component-removed"));
    change.migrationNote = "Use Button / XL instead.";
    const checks = validateRelease({ version: "2.4.0", existingVersions: [], changes: [change], trackedEntities: [] });
    expect(checks.find((c) => c.id === "breaking-documented")?.status).toBe("pass");
  });

  it("warns on a deprecated entity with no replacement", () => {
    const entity: TrackedEntity = {
      id: "comp-1",
      kind: "component",
      displayName: "Button / Large",
      deprecated: true,
      renameHistory: [],
    };
    const checks = validateRelease({ version: "2.4.0", existingVersions: [], changes: [], trackedEntities: [entity] });
    expect(checks.find((c) => c.id === "deprecated-have-replacements")?.status).toBe("warning");
  });

  it("passes everything when version is valid/unique and there's nothing to review", () => {
    const checks = validateRelease({ version: "2.4.0", existingVersions: ["1.0.0"], changes: [], trackedEntities: [] });
    expect(hasBlockingIssues(checks)).toBe(false);
    expect(checks.every((c) => c.status === "pass")).toBe(true);
  });
});
