import type { AuditCategory, ScanResult, ScanStats, TokenStats, VariableInfo, WcagLevel } from "@shared/types";
import { collectDocument, type CollectResult } from "./collect";
import { ruleRegistry } from "../rules/registry";
import type { RuleContext } from "../rules/types";
import { computeHealthScore } from "../scoring/healthScore";
import { createCheckpoint, ScanCancelledError } from "./checkpoint";

export { ScanCancelledError };

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
  const checkpoint = createCheckpoint(isCancelled);
  const collected = await collectDocument(onProgress, isCancelled, checkpoint);
  if (isCancelled()) throw new ScanCancelledError();

  const collectionNameById = new Map(collected.variableCollections.map((c) => [c.id, c.name] as const));
  const variablesByCollection = new Map<string, Variable[]>();
  for (const v of collected.variables) {
    const list = variablesByCollection.get(v.variableCollectionId);
    if (list) list.push(v);
    else variablesByCollection.set(v.variableCollectionId, [v]);
  }

  const context: RuleContext = {
    components: collected.components,
    variables: collected.variables,
    variableCollections: collected.variableCollections,
    collectionNameById,
    variablesByCollection,
    paintStyles: collected.paintStyles,
    textStyles: collected.textStyles,
    effectStyles: collected.effectStyles,
    gridStyles: collected.gridStyles,
    allComponentNodes: collected.allComponentNodes,
    instanceCounts: collected.instanceCounts,
    variantInstanceCounts: collected.variantInstanceCounts,
    wcagLevel,
    isCancelled,
    checkpoint
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

  const countByRule = new Map<string, number>();
  for (const issue of issues) countByRule.set(issue.ruleId, (countByRule.get(issue.ruleId) ?? 0) + 1);
  const countOf = (ruleId: string): number => countByRule.get(ruleId) ?? 0;

  const tokenStats: TokenStats = {
    totalVariables: collected.variables.length,
    totalCollections: collected.variableCollections.length,
    totalStyles,
    hardcodedColorCount: countOf("tokens-hardcoded-color"),
    hardcodedTypographyCount: countOf("typography-hardcoded-style"),
    hardcodedSpacingCount: countOf("spacing-off-grid"),
    hardcodedRadiusCount: countOf("tokens-hardcoded-radius"),
    hardcodedShadowCount: countOf("tokens-hardcoded-shadow"),
    hardcodedOpacityCount: countOf("tokens-hardcoded-opacity"),
    unusedVariableCount: countOf("tokens-unused-variable"),
    duplicateVariableCount: countOf("tokens-duplicate-variable"),
    brokenAliasCount: countOf("tokens-broken-alias")
  };

  const denominators = buildDenominators(collected, totalComponents + totalComponentSets);
  const health = computeHealthScore(issues, denominators);

  const variables: VariableInfo[] = collected.variables.map((v) => ({
    id: v.id,
    name: v.name,
    collectionId: v.variableCollectionId,
    collectionName: collectionNameById.get(v.variableCollectionId) ?? "Unknown collection",
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
