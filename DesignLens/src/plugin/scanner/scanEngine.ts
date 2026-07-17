import type { AuditCategory, ScanResult, ScanStats, TokenStats, VariableInfo, WcagLevel } from "@shared/types";
import { collectDocument, type CollectResult } from "./collect";
import { ruleRegistry } from "../rules/registry";
import type { RuleContext } from "../rules/types";
import { computeHealthScore } from "../scoring/healthScore";

export class ScanCancelledError extends Error {
  constructor() {
    super("Scan was cancelled");
    this.name = "ScanCancelledError";
  }
}

function buildDenominators(collected: CollectResult, componentCount: number): Record<AuditCategory, number> {
  const nodeDenominator = Math.max(1, Math.round(collected.allComponentNodes.length / 25));
  const tokenDenominator = Math.max(
    1,
    collected.variables.length + collected.paintStyles.length + collected.textStyles.length + collected.effectStyles.length + collected.gridStyles.length
  );
  const componentDenominator = Math.max(1, componentCount);

  return {
    accessibility: nodeDenominator,
    contrast: nodeDenominator,
    visual: nodeDenominator,
    typography: nodeDenominator,
    spacing: nodeDenominator,
    components: componentDenominator,
    states: componentDenominator,
    documentation: componentDenominator,
    governance: componentDenominator,
    tokens: tokenDenominator,
    deprecated: componentDenominator
  };
}

export async function runScan(
  onProgress: (phase: string, processed: number, total: number) => void,
  isCancelled: () => boolean,
  wcagLevel: WcagLevel
): Promise<ScanResult> {
  const startTime = Date.now();
  const collected = await collectDocument(onProgress, isCancelled);
  if (isCancelled()) throw new ScanCancelledError();

  const context: RuleContext = {
    components: collected.components,
    variables: collected.variables,
    variableCollections: collected.variableCollections,
    paintStyles: collected.paintStyles,
    textStyles: collected.textStyles,
    effectStyles: collected.effectStyles,
    gridStyles: collected.gridStyles,
    allComponentNodes: collected.allComponentNodes,
    instanceCounts: collected.instanceCounts,
    variantInstanceCounts: collected.variantInstanceCounts,
    wcagLevel,
    isCancelled
  };

  const issues = await ruleRegistry.runAll(context, (title, i, total) => onProgress(`Auditing: ${title}`, i, total));
  if (isCancelled()) throw new ScanCancelledError();

  const totalComponents = collected.components.filter((c) => c.info.type === "COMPONENT").length;
  const totalComponentSets = collected.components.filter((c) => c.info.type === "COMPONENT_SET").length;
  // A standalone COMPONENT's info.variantCount is a placeholder "1" (it represents itself as a
  // single row in the Components table) — it isn't a real Figma variant, so it must not be
  // counted here or the dashboard's "Total Variants" overstates how many actual variant
  // permutations exist by one for every standalone component in the library.
  const totalVariants = collected.components
    .filter((c) => c.info.type === "COMPONENT_SET")
    .reduce((sum, c) => sum + c.info.variantCount, 0);
  const totalStyles =
    collected.paintStyles.length + collected.textStyles.length + collected.effectStyles.length + collected.gridStyles.length;
  const deprecatedComponents = collected.components.filter((c) => c.info.isDeprecated).length;

  const stats: ScanStats = {
    totalComponents,
    totalComponentSets,
    totalVariants,
    totalVariables: collected.variables.length,
    totalTokens: collected.variables.length + totalStyles,
    totalLayers: collected.totalLayers,
    totalStyles,
    deprecatedComponents,
    scanDurationMs: Date.now() - startTime
  };

  const tokenStats: TokenStats = {
    totalVariables: collected.variables.length,
    totalCollections: collected.variableCollections.length,
    totalStyles,
    hardcodedColorCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-color").length,
    hardcodedTypographyCount: issues.filter((i) => i.ruleId === "typography-hardcoded-style").length,
    hardcodedSpacingCount: issues.filter((i) => i.ruleId === "spacing-off-grid").length,
    hardcodedRadiusCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-radius").length,
    hardcodedShadowCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-shadow").length,
    hardcodedOpacityCount: issues.filter((i) => i.ruleId === "tokens-hardcoded-opacity").length,
    unusedVariableCount: issues.filter((i) => i.ruleId === "tokens-unused-variable").length,
    duplicateVariableCount: issues.filter((i) => i.ruleId === "tokens-duplicate-variable").length,
    brokenAliasCount: issues.filter((i) => i.ruleId === "tokens-broken-alias").length
  };

  const denominators = buildDenominators(collected, totalComponents + totalComponentSets);
  const health = computeHealthScore(issues, denominators);

  const variables: VariableInfo[] = collected.variables.map((v) => ({
    id: v.id,
    name: v.name,
    collectionId: v.variableCollectionId,
    collectionName: collected.variableCollections.find((c) => c.id === v.variableCollectionId)?.name ?? "Unknown collection",
    resolvedType: v.resolvedType,
    isAlias: Object.values(v.valuesByMode).some(
      (value) => typeof value === "object" && value !== null && (value as { type?: string }).type === "VARIABLE_ALIAS"
    ),
    usageCount: 0
  }));

  return {
    scannedAt: new Date().toISOString(),
    fileName: figma.root.name,
    stats,
    tokenStats,
    health,
    issues,
    components: collected.components.map((c) => c.info),
    variables
  };
}
