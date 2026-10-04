import type { AuditCategory, Severity } from "./types";

/**
 * Shared so the plugin computes the score and the dashboard explains it from the same numbers.
 *
 * The brief specifies 8 weighted buckets (Accessibility 20, Component Quality 20, Documentation 15,
 * Token Usage 15, Typography 10, Spacing 10, Naming 5, Governance 5) but the rule engine tracks 11
 * finer-grained categories so issues can be filtered independently. Contrast is split out of
 * Accessibility and States out of Component Quality for filtering, Visual absorbs the remaining
 * "Naming" allowance, and Deprecated is inventory information rather than a quality defect, so it is
 * scored for display but carries no weight. Ratios otherwise track the brief's intent and sum to 1.
 */
export const CATEGORY_WEIGHTS: Record<AuditCategory, number> = {
  accessibility: 0.15,
  contrast: 0.1,
  components: 0.15,
  states: 0.05,
  documentation: 0.15,
  tokens: 0.15,
  typography: 0.08,
  spacing: 0.08,
  governance: 0.07,
  visual: 0.02,
  deprecated: 0
};

/** Points an issue costs its category, before dividing by the size of what was audited. */
export const SEVERITY_PENALTY: Record<Severity, number> = {
  critical: 10,
  warning: 4,
  suggestion: 1
};

/** Score bands used by every gauge, bar and badge so "healthy" means the same thing everywhere. */
export const SCORE_BANDS = { healthy: 85, needsWork: 60 } as const;
