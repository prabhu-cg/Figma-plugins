import { STORAGE_SCHEMA_VERSION } from "@shared/constants/storage";
import { createEmptyProject, type Project } from "@shared/types/project";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Structural validation for a Project blob loaded from clientStorage.
 * Deliberately shallow — it checks shape, not full field-by-field schema —
 * because storage corruption typically manifests as missing/wrong-typed
 * top-level fields (truncated chunk, JSON.parse of garbage, etc).
 */
export function isValidProject(value: unknown): value is Project {
  if (!isRecord(value)) return false;
  if (typeof value.schemaVersion !== "number") return false;
  if (!isArray(value.baselines)) return false;
  if (!isArray(value.releases)) return false;
  if (!isArray(value.changeSets)) return false;
  if (!isRecord(value.settings)) return false;
  return true;
}

/**
 * Migrates a project blob forward to the current schema version.
 * Unlike {@link isValidProject} (an all-or-nothing gate), this repairs
 * field-by-field: a single corrupted field (e.g. `releases` truncated to a
 * non-array) falls back to an empty default for that field alone, instead
 * of discarding baselines/changeSets that parsed correctly.
 */
export function migrateProject(value: unknown): Project {
  const empty = createEmptyProject(STORAGE_SCHEMA_VERSION);
  if (!isRecord(value)) return empty;

  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    currentBaselineId: typeof value.currentBaselineId === "string" ? value.currentBaselineId : undefined,
    baselines: isArray(value.baselines) ? (value.baselines as Project["baselines"]) : empty.baselines,
    releases: isArray(value.releases) ? (value.releases as Project["releases"]) : empty.releases,
    changeSets: isArray(value.changeSets) ? (value.changeSets as Project["changeSets"]) : empty.changeSets,
    settings: isRecord(value.settings) ? (value.settings as unknown as Project["settings"]) : empty.settings,
  };
}
