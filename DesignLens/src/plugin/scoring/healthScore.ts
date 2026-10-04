import { AUDIT_CATEGORIES, type AuditCategory, type CategoryScore, type HealthScore, type Issue } from "@shared/types";

import { CATEGORY_WEIGHTS, SEVERITY_PENALTY } from "@shared/scoring";

// Re-exported so existing imports keep working; the numbers live in shared/scoring.ts.
export { CATEGORY_WEIGHTS };

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
