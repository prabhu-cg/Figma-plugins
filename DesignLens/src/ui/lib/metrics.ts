import type { AuditCategory, ScanResult } from "@shared/types";

export interface DashboardMetrics {
  accessibilityScore: number;
  tokenCoverage: number;
  documentationCoverage: number;
  componentCoverage: number;
  namingConsistency: number;
  typographyScore: number;
  spacingScore: number;
  variantCoverage: number;
  stateCoverage: number;
}

export function computeDashboardMetrics(result: ScanResult): DashboardMetrics {
  const categoryScore = (id: AuditCategory) => result.health.categories.find((c) => c.category === id)?.score ?? 100;
  const totalComponents = Math.max(1, result.components.length);

  const documentationCoverage = Math.round(
    (result.components.filter((c) => c.hasDocumentation).length / totalComponents) * 100
  );

  const flaggedComponentIds = new Set(
    result.issues
      .filter((i) => (i.severity === "critical" || i.severity === "warning") && i.node?.componentId)
      .map((i) => i.node!.componentId)
  );
  const componentCoverage = Math.round(((totalComponents - flaggedComponentIds.size) / totalComponents) * 100);

  const componentsWithVariants = result.components.filter((c) => c.variantCount > 1).length;
  const variantCoverage = Math.round((componentsWithVariants / totalComponents) * 100);

  const typedComponents = result.components.filter((c) => c.detectedKind && c.detectedKind !== "unknown");
  const totalExpectedStates = typedComponents.reduce((sum, c) => sum + c.detectedStates.length + c.missingStates.length, 0);
  const totalCoveredStates = typedComponents.reduce((sum, c) => sum + c.detectedStates.length, 0);
  const stateCoverage = totalExpectedStates > 0 ? Math.round((totalCoveredStates / totalExpectedStates) * 100) : 100;

  return {
    accessibilityScore: Math.round((categoryScore("accessibility") + categoryScore("contrast")) / 2),
    tokenCoverage: categoryScore("tokens"),
    documentationCoverage,
    componentCoverage: Math.max(0, componentCoverage),
    namingConsistency: categoryScore("governance"),
    typographyScore: categoryScore("typography"),
    spacingScore: categoryScore("spacing"),
    variantCoverage,
    stateCoverage
  };
}

export interface PriorityCategory {
  category: AuditCategory;
  score: number;
  critical: number;
  warnings: number;
  /** weight x points lost: how much fixing this category would lift the overall score. */
  leverage: number;
}

/**
 * The categories worth fixing first: ranked by how many overall-score points they cost
 * (weight x points lost), so a mid-scoring heavy category outranks a low-scoring minor one.
 * Categories with no critical/warning issues, and zero-weight ones, are never suggested.
 */
export function priorityCategories(result: ScanResult, limit = 3): PriorityCategory[] {
  return result.health.categories
    .filter((c) => c.weight > 0 && c.criticalCount + c.warningCount > 0 && c.score < 100)
    .map((c) => ({
      category: c.category,
      score: c.score,
      critical: c.criticalCount,
      warnings: c.warningCount,
      leverage: c.weight * (100 - c.score)
    }))
    .sort((a, b) => b.leverage - a.leverage)
    .slice(0, limit);
}
