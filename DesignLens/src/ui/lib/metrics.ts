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
