import { describe, expect, it } from "vitest";
import { parseSemver, recommendVersion } from "@shared/utils/versionRecommendation";
import { classify } from "@plugin/classifier/classify";
import type { RawChange } from "@plugin/diff/rawChange";

function raw(changeType: string, extra: Partial<RawChange> = {}): RawChange {
  return { entityType: "component", entityId: "c1", entityName: "Button", changeType, ...extra };
}

describe("parseSemver", () => {
  it("parses a strict X.Y.Z version", () => {
    expect(parseSemver("2.4.0")).toEqual({ major: 2, minor: 4, patch: 0 });
  });

  it("tolerates trailing pre-release/build metadata", () => {
    expect(parseSemver("2.4.0-beta.1")).toEqual({ major: 2, minor: 4, patch: 0 });
  });

  it("returns null for an unparseable version", () => {
    expect(parseSemver("not-a-version")).toBeNull();
  });
});

describe("recommendVersion", () => {
  it("recommends no bump when there are no changes", () => {
    const rec = recommendVersion("2.4.0", []);
    expect(rec.bump).toBeNull();
    expect(rec.recommendedVersion).toBeNull();
  });

  it("recommends MAJOR when any breaking change is present", () => {
    const changes = [classify(raw("component-removed")), classify(raw("property-added"))];
    const rec = recommendVersion("2.4.0", changes);
    expect(rec.bump).toBe("major");
    expect(rec.recommendedVersion).toBe("3.0.0");
    expect(rec.reason).toContain("breaking");
  });

  it("recommends MINOR when there are additions but no breaking changes", () => {
    const changes = [classify(raw("component-added")), classify(raw("token-added", { entityType: "token" }))];
    const rec = recommendVersion("2.4.0", changes);
    expect(rec.bump).toBe("minor");
    expect(rec.recommendedVersion).toBe("2.5.0");
    expect(rec.reason).toContain("component");
    expect(rec.reason).toContain("token");
  });

  it("recommends PATCH for non-breaking, non-additive changes", () => {
    const changes = [classify(raw("component-description-changed"))];
    const rec = recommendVersion("2.4.0", changes);
    expect(rec.bump).toBe("patch");
    expect(rec.recommendedVersion).toBe("2.4.1");
  });

  it("still returns a bump and reason when the current version doesn't parse, just no computed next version", () => {
    const changes = [classify(raw("component-removed"))];
    const rec = recommendVersion("not-a-version", changes);
    expect(rec.bump).toBe("major");
    expect(rec.recommendedVersion).toBeNull();
  });

  it("honors a manual classification override when deciding the bump", () => {
    const change = classify(raw("component-removed"));
    change.manualClassification = { breaking: false, potentialBreaking: false, overriddenAt: "2026-01-01T00:00:00Z" };
    const rec = recommendVersion("2.4.0", [change]);
    expect(rec.bump).toBe("patch");
  });

  it("never recommends a version that's already been used, escalating within the same bump level", () => {
    const changes = [classify(raw("component-added"))];
    // A minor bump from 1.0.0 would naively land on 1.1.0, but that's
    // already taken (e.g. from earlier duplicate test releases) — it
    // should keep incrementing the minor position, not fall back to a
    // patch bump, since the recommendation is still "a minor-level change".
    const rec = recommendVersion("1.0.0", changes, ["1.1.0", "1.2.0"]);
    expect(rec.bump).toBe("minor");
    expect(rec.recommendedVersion).toBe("1.3.0");
  });

  it("recommends the naive next version when it isn't already taken", () => {
    const changes = [classify(raw("component-added"))];
    const rec = recommendVersion("1.0.0", changes, ["9.9.9"]);
    expect(rec.recommendedVersion).toBe("1.1.0");
  });
});
