import { describe, expect, it } from "vitest";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("classify", () => {
  it("marks component removal as definitively breaking", () => {
    const change = classify(raw("component-removed"));
    expect(change.category).toBe("removed");
    expect(change.breaking).toBe(true);
    expect(change.potentialBreaking).toBe(false);
  });

  it("marks variant removal as definitively breaking (spec §10)", () => {
    const change = classify(raw("variant-removed"));
    expect(change.breaking).toBe(true);
    expect(change.potentialBreaking).toBe(false);
  });

  it("marks token alias removal as definitively breaking, distinct from a mere alias retarget", () => {
    const removed = classify(raw("token-alias-removed", { entityType: "token" }));
    expect(removed.breaking).toBe(true);

    const retargeted = classify(raw("token-alias-changed", { entityType: "token" }));
    expect(retargeted.breaking).toBe(false);
    expect(retargeted.potentialBreaking).toBe(false);
  });

  it("marks component property type change as definitively breaking, distinct from other property edits", () => {
    const typeChanged = classify(raw("property-type-changed"));
    expect(typeChanged.breaking).toBe(true);

    const otherEdit = classify(raw("property-changed"));
    expect(otherEdit.breaking).toBe(false);
    expect(otherEdit.potentialBreaking).toBe(true);
  });

  it("marks token value change as potentially breaking (spec §10), not silently non-breaking", () => {
    const change = classify(raw("token-value-changed", { entityType: "token" }));
    expect(change.breaking).toBe(false);
    expect(change.potentialBreaking).toBe(true);
  });

  it("marks component addition as info, non-breaking", () => {
    const change = classify(raw("component-added"));
    expect(change.category).toBe("added");
    expect(change.severity).toBe("info");
    expect(change.breaking).toBe(false);
    expect(change.potentialBreaking).toBe(false);
  });

  it("marks token removal as definitively breaking", () => {
    const change = classify(raw("token-removed", { entityType: "token" }));
    expect(change.breaking).toBe(true);
  });

  it("marks token rename as changed, potentially breaking", () => {
    const change = classify(raw("token-renamed", { entityType: "token" }));
    expect(change.category).toBe("modified");
    expect(change.potentialBreaking).toBe(true);
  });

  it("falls back to a conservative default rule for unknown change types", () => {
    const change = classify(raw("some-unmapped-change-type"));
    expect(change.category).toBe("modified");
    expect(change.potentialBreaking).toBe(true);
  });

  it("assigns a unique id and ISO timestamp", () => {
    const a = classify(raw("component-added"));
    const b = classify(raw("component-added"));
    expect(a.id).not.toBe(b.id);
    expect(() => new Date(a.createdAt).toISOString()).not.toThrow();
  });
});
