import type { Change } from "@shared/types/change";
import type { TrackedEntity } from "@shared/types/entity";
import { getEffectiveClassification } from "./classification";
import { parseSemver } from "./versionRecommendation";

export interface ValidationCheck {
  id: string;
  label: string;
  status: "pass" | "warning" | "blocking";
  detail?: string;
}

/**
 * Release readiness checklist (spec §10). Only a genuinely required
 * condition — an invalid or duplicate version — blocks release creation;
 * everything else is a warning the user can see and choose to ignore
 * (spec: "allow users to override warnings").
 */
export function validateRelease(input: {
  version: string;
  existingVersions: string[];
  changes: Change[];
  trackedEntities: TrackedEntity[];
}): ValidationCheck[] {
  const { version, existingVersions, changes, trackedEntities } = input;
  const trimmedVersion = version.trim();
  const checks: ValidationCheck[] = [];

  const versionValid = trimmedVersion.length > 0 && parseSemver(trimmedVersion) !== null;
  checks.push({
    id: "version-valid",
    label: "Version valid",
    status: versionValid ? "pass" : "blocking",
    detail: versionValid ? undefined : "Enter a version in X.Y.Z form.",
  });

  const isDuplicate = versionValid && existingVersions.includes(trimmedVersion);
  checks.push({
    id: "version-unique",
    label: "Version not already used",
    status: isDuplicate ? "blocking" : "pass",
    detail: isDuplicate ? `v${trimmedVersion} has already been released.` : undefined,
  });

  const unreviewedCount = changes.filter((c) => c.reviewState === "unreviewed").length;
  checks.push({
    id: "changes-reviewed",
    label: "All changes reviewed",
    status: unreviewedCount === 0 ? "pass" : "warning",
    detail: unreviewedCount === 0 ? undefined : `${unreviewedCount} change${unreviewedCount === 1 ? "" : "s"} unreviewed.`,
  });

  const breakingChanges = changes.filter((c) => getEffectiveClassification(c).breaking);
  const undocumentedBreaking = breakingChanges.filter((c) => !c.migrationNote?.trim());
  checks.push({
    id: "breaking-documented",
    label: "Breaking changes documented",
    status: undocumentedBreaking.length === 0 ? "pass" : "warning",
    detail:
      undocumentedBreaking.length === 0
        ? undefined
        : `${undocumentedBreaking.length} breaking change${undocumentedBreaking.length === 1 ? "" : "s"} missing a migration note.`,
  });

  const deprecatedWithoutReplacement = trackedEntities.filter((e) => e.deprecated && !e.replacement?.trim());
  checks.push({
    id: "deprecated-have-replacements",
    label: "Deprecated items have replacements",
    status: deprecatedWithoutReplacement.length === 0 ? "pass" : "warning",
    detail:
      deprecatedWithoutReplacement.length === 0
        ? undefined
        : `${deprecatedWithoutReplacement.length} deprecated item${deprecatedWithoutReplacement.length === 1 ? "" : "s"} without a replacement.`,
  });

  const undescribedCount = changes.filter((c) => !c.reviewNote?.trim()).length;
  checks.push({
    id: "changes-described",
    label: "Changes have a description",
    status: undescribedCount === 0 ? "pass" : "warning",
    detail: undescribedCount === 0 ? undefined : `${undescribedCount} change${undescribedCount === 1 ? "" : "s"} have no description.`,
  });

  return checks;
}

export function hasBlockingIssues(checks: ValidationCheck[]): boolean {
  return checks.some((c) => c.status === "blocking");
}
