import type { Change, ChangeCategory, ChangeSeverity, ChangeVerdict } from "@shared/types/change";

export interface EffectiveClassification {
  category: ChangeCategory;
  severity: ChangeSeverity;
  breaking: boolean;
  potentialBreaking: boolean;
  overridden: boolean;
}

/**
 * The classifier's output is always deterministic, but spec §10/§11
 * require a human to be able to override it. `manualClassification` layers
 * on top rather than replacing the record, so the original machine
 * classification is never lost.
 */
export function getEffectiveClassification(change: Change): EffectiveClassification {
  const override = change.manualClassification;
  return {
    category: override?.category ?? change.category,
    severity: override?.severity ?? change.severity,
    breaking: override?.breaking ?? change.breaking,
    potentialBreaking: override?.potentialBreaking ?? change.potentialBreaking,
    overridden: Boolean(override),
  };
}

/**
 * Deterministic, human-facing verdict labels (spec §11) — DSLog never
 * shows an AI-style confidence score, only one of these four buckets.
 */
export function getVerdict(change: Change): ChangeVerdict {
  const effective = getEffectiveClassification(change);
  if (effective.breaking) return "breaking";
  if (effective.potentialBreaking) return "potentially-breaking";
  if (effective.severity === "info") return "informational";
  return "non-breaking";
}

export const VERDICT_LABEL: Record<ChangeVerdict, string> = {
  breaking: "Breaking",
  "potentially-breaking": "Potentially breaking",
  "non-breaking": "Non-breaking",
  informational: "Informational",
};

export function getVerdictLabel(change: Change): string {
  return VERDICT_LABEL[getVerdict(change)];
}
