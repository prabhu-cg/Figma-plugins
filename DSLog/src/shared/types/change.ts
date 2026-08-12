import type { ReviewState } from "./entity";

export type ChangeEntityType = "component" | "token";

export type ChangeCategory = "added" | "removed" | "modified" | "deprecated";

export type ChangeSeverity = "info" | "minor" | "major";

/** Deterministic, human-facing verdict labels (spec §11) — never a confidence score. */
export type ChangeVerdict = "breaking" | "potentially-breaking" | "non-breaking" | "informational";

/** Human override of the deterministic classifier output (spec §10/§11 "always allow human override"). */
export interface ManualClassification {
  category?: ChangeCategory;
  severity?: ChangeSeverity;
  breaking?: boolean;
  potentialBreaking?: boolean;
  overriddenAt: string;
}

export interface Change {
  id: string;
  entityType: ChangeEntityType;
  entityId: string;
  entityName: string;

  category: ChangeCategory;

  severity: ChangeSeverity;

  /** Machine-readable change type, e.g. "variant-removed", "token-value-changed". */
  changeType: string;

  /** Human-readable summary of the change, e.g. "Removed variant Large". */
  summary: string;

  /** Sub-field the change applies to, if applicable, e.g. "padding.horizontal". */
  field?: string;

  before?: unknown;
  after?: unknown;

  breaking: boolean;
  /** True when confidence in the breaking classification is insufficient. */
  potentialBreaking: boolean;

  /** Per-mode detail, used for token changes. */
  modeDetails?: Array<{
    modeName: string;
    before?: unknown;
    after?: unknown;
    changed: boolean;
  }>;

  reviewState: ReviewState;
  reviewNote?: string;
  migrationNote?: string;

  /** Set when a human overrides the deterministic classification (spec §10/§11). */
  manualClassification?: ManualClassification;

  /** Links a "-added" Change to the paired "-removed" Change when the rename heuristic fires (spec §13). */
  possibleRenameOf?: string;
  renameResolution?: "confirmed" | "dismissed";

  createdAt: string;
}

export interface ChangeSet {
  id: string;
  baselineId: string;
  createdAt: string;
  changes: Change[];
  scanSummary: {
    componentsScanned: number;
    componentsSkipped: number;
    tokensScanned: number;
    tokensSkipped: number;
    skippedItems: Array<{ id: string; name: string; reason: string }>;
  };
}
