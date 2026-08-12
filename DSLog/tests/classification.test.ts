import { describe, expect, it } from "vitest";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";
import { getEffectiveClassification, getVerdict, getVerdictLabel } from "@shared/utils/classification";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("classification", () => {
  it("derives deterministic verdict labels from the classifier output with no override", () => {
    const change = classify(raw("component-removed"));
    expect(getVerdict(change)).toBe("breaking");
    expect(getVerdictLabel(change)).toBe("Breaking");
    expect(getEffectiveClassification(change).overridden).toBe(false);
  });

  it("labels an info-severity, non-breaking change as informational", () => {
    const change = classify(raw("component-description-changed"));
    expect(getVerdict(change)).toBe("informational");
  });

  it("labels a minor-severity, non-breaking change as non-breaking", () => {
    const change = classify(raw("fills-changed"));
    expect(getVerdict(change)).toBe("non-breaking");
  });

  it("lets a manual override supersede the deterministic classification without discarding it", () => {
    const change = classify(raw("component-removed"));
    expect(change.breaking).toBe(true); // original classifier output preserved

    change.manualClassification = { breaking: false, potentialBreaking: false, overriddenAt: "2026-01-01T00:00:00Z" };
    const effective = getEffectiveClassification(change);
    expect(effective.breaking).toBe(false);
    expect(effective.overridden).toBe(true);
    expect(getVerdict(change)).toBe("non-breaking");
    // The machine classification itself is untouched.
    expect(change.breaking).toBe(true);
  });
});
