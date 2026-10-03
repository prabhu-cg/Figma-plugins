import { useEffect, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { getLatestChangeSetForBaseline } from "@shared/utils/changeSets";
import { recommendVersion } from "@shared/utils/versionRecommendation";
import { hasBlockingIssues, validateRelease } from "@shared/utils/releaseValidation";
import { buildMigrationReport } from "@shared/utils/migrationReport";

/**
 * Everything the Releases page needs to build a release: the form state, what the project says about
 * the pending changes, and the reasons "Create release" may be unavailable. It lives above the tabs so a
 * half-filled form survives switching to "Past releases" and back.
 */
export function useReleaseDraft() {
  const { project, send } = useProjectState();
  const [version, setVersion] = useState("");
  const [versionEdited, setVersionEdited] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // Everything is included by default: leaving a section out is the deliberate choice, not the default.
  const [includeComponents, setIncludeComponents] = useState(true);
  const [includeTokens, setIncludeTokens] = useState(true);
  const [includeBreaking, setIncludeBreaking] = useState(true);
  const [includeMigration, setIncludeMigration] = useState(true);

  const baseline = project?.baselines.find((b) => b.id === project.currentBaselineId);
  const changeSet = project && baseline ? getLatestChangeSetForBaseline(project, baseline.id) : undefined;
  const changesSinceRelease = changeSet?.changes ?? [];

  const existingVersions = project?.releases.map((r) => r.version) ?? [];
  const recommendation = baseline
    ? recommendVersion(baseline.version, changesSinceRelease, existingVersions)
    : undefined;
  const recommendedVersion = recommendation?.recommendedVersion;

  // Start from the recommended version rather than a hardcoded one, until the user types their own.
  useEffect(() => {
    if (!versionEdited && recommendedVersion) setVersion(recommendedVersion);
  }, [recommendedVersion, versionEdited]);

  const validationChecks = validateRelease({
    version,
    existingVersions,
    changes: changesSinceRelease,
    trackedEntities: project?.trackedEntities ?? [],
  });
  const migrationItems = buildMigrationReport(changesSinceRelease, project?.trackedEntities ?? []);

  const unreviewedInRelease = changesSinceRelease.filter((c) => c.reviewState === "unreviewed").length;
  const includedCount = [includeComponents, includeTokens, includeBreaking, includeMigration].filter(Boolean).length;
  // Say exactly why "Create release" is unavailable, next to the button, instead of leaving it silently disabled.
  const blockers: string[] = [];
  if (version.trim().length === 0) blockers.push("Enter a version");
  if (title.trim().length === 0) blockers.push("Add a release title");
  if (includedCount === 0) blockers.push("Include at least one section");
  for (const check of validationChecks) {
    if (check.status === "blocking") blockers.push(check.label);
  }
  const canCreate = blockers.length === 0 && !hasBlockingIssues(validationChecks);


  function editVersion(next: string) {
    setVersion(next);
    setVersionEdited(true);
  }

  const createRelease = () => {
    setConfirming(false);
    send({
      type: "create-release",
      version: version.trim(),
      title: title.trim(),
      description: description.trim() || undefined,
      include: {
        components: includeComponents,
        tokens: includeTokens,
        breakingChanges: includeBreaking,
        migrationNotes: includeMigration,
      },
    });
  };

  return {
    baseline,
    changesSinceRelease,
    recommendation,
    validationChecks,
    migrationItems,
    unreviewedInRelease,
    includedCount,
    blockers,
    canCreate,
    version,
    editVersion,
    title,
    setTitle,
    description,
    setDescription,
    confirming,
    setConfirming,
    includeComponents,
    setIncludeComponents,
    includeTokens,
    setIncludeTokens,
    includeBreaking,
    setIncludeBreaking,
    includeMigration,
    setIncludeMigration,
    createRelease,
  };
}

export type ReleaseDraft = ReturnType<typeof useReleaseDraft>;
