import type { ChangeCategory, ChangeSeverity } from "@shared/types/change";

export interface ClassificationRule {
  category: ChangeCategory;
  severity: ChangeSeverity;
  breaking: boolean;
  potentialBreaking: boolean;
}

/**
 * Classification table implementing spec section 15. `breaking: true` means
 * DSLog is confident the change breaks consumers; `potentialBreaking: true`
 * means confidence is insufficient and the UI must say "Potential breaking
 * change" rather than assert certainty.
 */
export const CLASSIFICATION_RULES: Record<string, ClassificationRule> = {
  "component-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "component-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "component-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "component-description-changed": {
    category: "modified",
    severity: "info",
    breaking: false,
    potentialBreaking: false,
  },

  "property-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "property-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "property-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },

  "variant-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "variant-removed": { category: "removed", severity: "major", breaking: false, potentialBreaking: true },

  "structure-child-added": { category: "added", severity: "minor", breaking: false, potentialBreaking: false },
  "structure-child-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
  "structure-child-type-changed": {
    category: "modified",
    severity: "minor",
    breaking: false,
    potentialBreaking: true,
  },
  "visibility-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "dimensions-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "corner-radius-changed": { category: "modified", severity: "info", breaking: false, potentialBreaking: false },
  "fills-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "strokes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "effects-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "typography-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "token-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "style-binding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "layout-mode-changed": { category: "modified", severity: "major", breaking: false, potentialBreaking: true },
  "padding-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "gap-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "alignment-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },

  "token-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "token-removed": { category: "removed", severity: "major", breaking: true, potentialBreaking: false },
  "token-renamed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
  "token-type-changed": { category: "modified", severity: "major", breaking: false, potentialBreaking: true },
  "token-mode-added": { category: "added", severity: "info", breaking: false, potentialBreaking: false },
  "token-mode-removed": { category: "removed", severity: "minor", breaking: false, potentialBreaking: true },
  "token-value-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "token-alias-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: false },
  "token-description-changed": {
    category: "modified",
    severity: "info",
    breaking: false,
    potentialBreaking: false,
  },
  "token-scopes-changed": { category: "modified", severity: "minor", breaking: false, potentialBreaking: true },
};

export const DEFAULT_RULE: ClassificationRule = {
  category: "modified",
  severity: "minor",
  breaking: false,
  potentialBreaking: true,
};
