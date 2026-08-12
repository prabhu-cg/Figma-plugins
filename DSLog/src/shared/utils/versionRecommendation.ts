import type { Change } from "@shared/types/change";
import { getEffectiveClassification } from "./classification";
import { summarizeChanges } from "./changeSetStats";

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
}

/** Reads only the leading X.Y.Z — tolerant of trailing pre-release/build metadata. */
export function parseSemver(version: string): SemverParts | null {
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) };
}

export type VersionBump = "major" | "minor" | "patch";

export interface VersionRecommendation {
  /** null when there's nothing to base a recommendation on. */
  bump: VersionBump | null;
  /** null when `currentVersion` doesn't parse as X.Y.Z — the reason is still shown, just not a computed next version. */
  recommendedVersion: string | null;
  reason: string;
}

/**
 * Deterministic MAJOR/MINOR/PATCH recommendation (spec §4): any breaking
 * change -> major, else any addition -> minor, else patch. Purely advisory
 * — the caller must still let the user approve/edit before it's used.
 */
export function recommendVersion(currentVersion: string, changes: Change[]): VersionRecommendation {
  if (changes.length === 0) {
    return { bump: null, recommendedVersion: null, reason: "No changes detected since the current baseline." };
  }

  const stats = summarizeChanges(changes);
  let bump: VersionBump;
  let reason: string;

  if (stats.breaking > 0) {
    bump = "major";
    reason = `${stats.breaking} breaking change${stats.breaking === 1 ? "" : "s"} detected.`;
  } else if (stats.added > 0) {
    const addedComponents = changes.filter(
      (c) => c.entityType === "component" && getEffectiveClassification(c).category === "added",
    ).length;
    const addedTokens = changes.filter(
      (c) => c.entityType === "token" && getEffectiveClassification(c).category === "added",
    ).length;
    const parts: string[] = [];
    if (addedComponents > 0) parts.push(`${addedComponents} new component${addedComponents === 1 ? "" : "s"}`);
    if (addedTokens > 0) parts.push(`${addedTokens} new token${addedTokens === 1 ? "" : "s"}`);
    bump = "minor";
    reason = `${parts.join(" and ")} added.`;
  } else {
    bump = "patch";
    reason = `${changes.length} non-breaking change${changes.length === 1 ? "" : "s"}.`;
  }

  const parsed = parseSemver(currentVersion);
  if (!parsed) {
    return { bump, recommendedVersion: null, reason };
  }

  const recommendedVersion =
    bump === "major"
      ? `${parsed.major + 1}.0.0`
      : bump === "minor"
        ? `${parsed.major}.${parsed.minor + 1}.0`
        : `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;

  return { bump, recommendedVersion, reason };
}
