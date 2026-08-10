export type ChangeEntityType = "component" | "token";

export type ChangeCategory = "added" | "removed" | "modified" | "deprecated";

export type ChangeSeverity = "info" | "minor" | "major";

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

  reviewed: boolean;
  reviewNote?: string;
  migrationNote?: string;

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
