import type { ChangeCategory, ChangeSeverity } from "@shared/types/change";

export interface ClassificationRule {
  category: ChangeCategory;
  severity: ChangeSeverity;
  breaking: boolean;
  potentialBreaking: boolean;
}

/**
 * Classification table implementing spec section 10's explicit BREAKING /
 * POTENTIALLY BREAKING / NON-BREAKING lists. `breaking: true` means DSLog
 * is confident the change breaks consumers; `potentialBreaking: true` means
 * confidence is insufficient and the UI must say "Potential breaking
 * change" rather than assert certainty (spec section 11 — no confidence
 * scores, only these deterministic buckets). A human can always override
 * via `Change.manualClassification` (see `shared/utils/classification.ts`).
 */
export const CLASSIFICATION_RULES: Record<string, ClassificationRule> = {
  // --- BREAKING ---
  "component-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "property-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "variant-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "token-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "token-type-changed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },
  "token-alias-removed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },
  "property-type-changed": { category: "modified", severity: "major", breaking: true, potentialBreaking: false },

  // --- POTENTIALLY BREAKING ---
  "component-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "property-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "structure-child-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
  "structure-child-type-changed": {
    category: "modified",
    severity: "minor",
    breaking: false,
    potentialBreaking: true,
  },
  "visibility-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "dimensions-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "typography-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "token-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "style-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "layout-mode-changed": { category: "modified", severity: "major", breaking: false, potentialBreaking: true },
  "padding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "gap-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "alignment-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "token-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "token-mode-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
  "token-value-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "token-scopes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },

  // --- NON-BREAKING / INFORMATIONAL ---
  "component-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "component-description-changed": {
    category: "modified",
    severity: "info",
    breaking: false,
    potentialBreaking: false,
  },
  "property-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "variant-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "structure-child-added": { category: "added", severity: "minor", breaking: false, potentialBreaking: false },
  "corner-radius-changed": { category: "modified", severity: "info", breaking: false, potentialBreaking: false },
  "fills-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "strokes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "effects-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "token-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "token-mode-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "token-alias-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "token-description-changed": {
    category: "modified",
    severity: "info",
    breaking: false,
    potentialBreaking: false,
  },
};

export const DEFAULT_RULE: ClassificationRule = {
  category: "modified",
  severity: "minor",
  breaking: false,
  potentialBreaking: true,
};
