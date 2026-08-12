import { describe, expect, it } from "vitest";
import { summarizeChanges } from "@shared/utils/changeSetStats";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("summarizeChanges", () => {
  it("counts changes by effective category and breaking verdict", () => {
    const changes = [
      classify(raw("component-added")),
      classify(raw("component-removed")),
      classify(raw("property-changed")),
      classify(raw("variant-removed")), // breaking per V2 rules
    ];
    const stats = summarizeChanges(changes);
    expect(stats.total).toBe(4);
    expect(stats.added).toBe(1);
    expect(stats.removed).toBe(2); // component-removed + variant-removed
    expect(stats.modified).toBe(1);
    expect(stats.breaking).toBe(2); // component-removed + variant-removed
  });

  it("honors a manual classification override", () => {
    const change = classify(raw("component-removed"));
    change.manualClassification = { breaking: false, potentialBreaking: false, overriddenAt: "2026-01-01T00:00:00Z" };
    const stats = summarizeChanges([change]);
    expect(stats.breaking).toBe(0);
  });

  it("returns all zeros for an empty list", () => {
    expect(summarizeChanges([])).toEqual({ total: 0, added: 0, modified: 0, removed: 0, deprecated: 0, breaking: 0 });
  });
});
