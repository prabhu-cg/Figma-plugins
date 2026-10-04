import { AUDIT_CATEGORIES, type AuditCategory, type CategoryScore, type HealthScore, type Issue } from "@shared/types";

/**
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

const SEVERITY_PENALTY: Record<Issue["severity"], number> = {
  critical: 10,
  warning: 4,
  suggestion: 1
};

export function computeHealthScore(issues: Issue[], denominators: Record<AuditCategory, number>): HealthScore {
  // One pass over the issue list instead of re-filtering it per category and severity.
  const counts = new Map<AuditCategory, Record<Issue["severity"], number>>();
  for (const category of AUDIT_CATEGORIES) counts.set(category, { critical: 0, warning: 0, suggestion: 0 });
  for (const issue of issues) {
    const bucket = counts.get(issue.category);
    if (bucket) bucket[issue.severity] += 1;
  }

  const categories: CategoryScore[] = AUDIT_CATEGORIES.map((category) => {
    const { critical: criticalCount, warning: warningCount, suggestion: suggestionCount } = counts.get(category)!;
    const denominator = Math.max(1, denominators[category] ?? 1);

    const penalty =
      (criticalCount * SEVERITY_PENALTY.critical +
        warningCount * SEVERITY_PENALTY.warning +
        suggestionCount * SEVERITY_PENALTY.suggestion) /
      denominator;

    const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));
    const passCount = Math.max(0, Math.round(denominator) - (criticalCount + warningCount + suggestionCount));

    return {
      category,
      score,
      weight: CATEGORY_WEIGHTS[category],
      criticalCount,
      warningCount,
      suggestionCount,
      passCount
    };
  });

  const overall = Math.round(categories.reduce((sum, c) => sum + c.score * c.weight, 0));

  return {
    overall,
    categories,
    totalCritical: categories.reduce((sum, c) => sum + c.criticalCount, 0),
    totalWarnings: categories.reduce((sum, c) => sum + c.warningCount, 0),
    totalSuggestions: categories.reduce((sum, c) => sum + c.suggestionCount, 0),
    totalSuccesses: categories.reduce((sum, c) => sum + c.passCount, 0)
  };
}
