/**
 * Synthetic demo data for the Community listing screenshots. Nothing here comes from a real file or
 * real users: component names are generic, counts are authored, and the issue titles, rationale and
 * recommendations are the plugin's real rule text. The health score is computed by the real
 * computeHealthScore, so the screenshots can't show a number the product wouldn't produce.
 */
import { AUDIT_CATEGORIES, type AuditCategory, type ComponentInfo, type Issue, type ScanResult, type TrendEntry, type VariableInfo } from "../../src/shared/types";
import { computeHealthScore } from "../../src/plugin/scoring/healthScore";
import { contrastRules } from "../../src/plugin/rules/contrast";
import { typographyRules } from "../../src/plugin/rules/typography";
import { spacingRules } from "../../src/plugin/rules/spacing";
import { tokenRules } from "../../src/plugin/rules/tokens";
import { componentRules } from "../../src/plugin/rules/components";
import { stateRules } from "../../src/plugin/rules/states";
import { accessibilityRules } from "../../src/plugin/rules/accessibility";
import { documentationRules } from "../../src/plugin/rules/documentation";
import { governanceRules } from "../../src/plugin/rules/governance";
import { deprecatedRules } from "../../src/plugin/rules/deprecated";
import { visualRules } from "../../src/plugin/rules/visual";
import type { AuditRule } from "../../src/plugin/rules/types";

let seed = 20261004;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const pick = <T,>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

const ALL_RULES: AuditRule[] = [
  ...contrastRules, ...typographyRules, ...spacingRules, ...tokenRules, ...componentRules, ...stateRules,
  ...accessibilityRules, ...documentationRules, ...governanceRules, ...deprecatedRules, ...visualRules
];
const rule = (id: string): AuditRule => {
  const r = ALL_RULES.find((x) => x.id === id);
  if (!r) throw new Error("unknown rule " + id);
  return r;
};

const ALL_COMPONENTS: { name: string; kind: ComponentInfo["detectedKind"]; variants: number; docs: boolean }[] = [
  { name: "Button", kind: "button", variants: 24, docs: true }, { name: "Input Box", kind: "input", variants: 12, docs: true },
  { name: "Checkbox", kind: "checkbox", variants: 8, docs: true }, { name: "Radio", kind: "radio", variants: 6, docs: false },
  { name: "Switch", kind: "switch", variants: 6, docs: true }, { name: "Select", kind: "select", variants: 9, docs: false },
  { name: "Tabs", kind: "tab", variants: 6, docs: true }, { name: "Accordion", kind: "accordion", variants: 4, docs: false },
  { name: "Menu Item", kind: "menu-item", variants: 10, docs: false }, { name: "Link", kind: "link", variants: 6, docs: true },
  { name: "Card", kind: "card", variants: 5, docs: true }, { name: "Badge", kind: "badge", variants: 12, docs: true },
  { name: "Alert", kind: "alert", variants: 8, docs: false }, { name: "Toast", kind: "alert", variants: 4, docs: false },
  { name: "Tooltip", kind: "unknown", variants: 4, docs: true }, { name: "Avatar", kind: "unknown", variants: 8, docs: true },
  { name: "Modal", kind: "unknown", variants: 3, docs: false }, { name: "Pagination", kind: "unknown", variants: 4, docs: false },
  { name: "Breadcrumb", kind: "unknown", variants: 2, docs: true }, { name: "Table Row", kind: "unknown", variants: 6, docs: false },
  { name: "Icon / Close", kind: "icon", variants: 1, docs: true }, { name: "Icon / Search", kind: "icon", variants: 1, docs: true },
  { name: "Icon / Arrow", kind: "icon", variants: 4, docs: false }, { name: "Date Picker", kind: "input", variants: 6, docs: false },
  { name: "Slider", kind: "unknown", variants: 3, docs: true }, { name: "Progress Bar", kind: "unknown", variants: 3, docs: true },
  { name: "Empty State", kind: "unknown", variants: 2, docs: false }, { name: "Nav Rail", kind: "unknown", variants: 2, docs: true },
  { name: "Legacy Button (deprecated)", kind: "button", variants: 6, docs: false }, { name: "Chip", kind: "badge", variants: 6, docs: false }
];

const COMPONENTS = ALL_COMPONENTS.slice(0, 10);

const nodeFor = (c: ComponentInfo, layer: string) => ({
  id: `${c.id}:${layer.length}${Math.floor(rand() * 90 + 10)}`, name: layer, type: "FRAME", pageId: "0:1", pageName: c.pageName, componentId: c.id, componentName: c.name
});

type Gen = (c: ComponentInfo) => { description: string; meta?: Issue["meta"] };
const GEN: Record<string, Gen> = {
  "a11y-focus-visibility": (c) => ({ description: `The Focus variant of ${c.name} has no visible stroke/outline.` }),
  "contrast-text-aa": (c) => ({ description: `"${pick(["Label", "Helper text", "Placeholder", "Caption"])}" in ${c.name} has a contrast ratio of ${(2.1 + rand() * 1.9).toFixed(2)}:1, below the 4.5:1 AA minimum for normal text.` }),
  "contrast-ui-component": (c) => ({ description: `Border on ${c.name} / Default has a contrast ratio of ${(1.3 + rand() * 1.5).toFixed(2)}:1, below the 3:1 minimum for UI components.` }),
  "tokens-hardcoded-color": (c) => ({ description: `Fill on "${pick(["Background", "Label", "Icon", "Divider"])}" in ${c.name} is a hardcoded color, not a variable.` }),
  "tokens-hardcoded-radius": (c) => ({ description: `"Container" in ${c.name} has a hardcoded ${pick([6, 10, 14])}px corner radius.` }),
  "tokens-hardcoded-opacity": (c) => ({ description: `"Overlay" in ${c.name} has a hardcoded opacity of ${pick([48, 64, 72])}%.` }),
  "typography-hardcoded-style": (c) => ({ description: `"${pick(["Label", "Title", "Helper"])}" in ${c.name} has no linked text style.` }),
  "spacing-off-grid": (c) => ({ description: `${c.name} has padding top of ${pick([5, 10, 14, 18])}px, off the 4px grid.` }),
  "spacing-missing-autolayout": (c) => ({ description: `Frame "Content" in ${c.name} has 3 children but no Auto Layout.` }),
  "components-missing-description": (c) => ({ description: `"${c.name}" has no description.` }),
  "states-missing-expected": (c) => ({ description: `${c.name} (detected as "${c.detectedKind}") is missing states: ${c.missingStates.join(", ") || "focus"}.` }),
  "a11y-touch-target-size": (c) => ({ description: `${c.name} / Size=Small is 32x28px, below the 44x44px recommended touch target.` }),
  "docs-incomplete-sections": (c) => ({ description: `${c.name}'s description is missing: Don't, Accessibility.` }),
  "governance-legacy-naming": (c) => ({ description: `"${c.name}" carries a legacy/placeholder naming marker.` }),
  "deprecated-flagged": (c) => ({ description: `"${c.name}" is marked deprecated and still has 14 instances in this file.` })
};

// How many issues each rule contributes (authored to give a believable "needs work" library).
const PLAN: [string, number][] = [
  ["a11y-focus-visibility", 7], ["contrast-text-aa", 14], ["contrast-ui-component", 6], ["a11y-touch-target-size", 6],
  ["tokens-hardcoded-color", 64], ["tokens-hardcoded-radius", 18], ["tokens-hardcoded-opacity", 9],
  ["typography-hardcoded-style", 22], ["spacing-off-grid", 16], ["spacing-missing-autolayout", 8],
  ["components-missing-description", 13], ["states-missing-expected", 9], ["docs-incomplete-sections", 12],
  ["governance-legacy-naming", 3], ["deprecated-flagged", 1]
];

const STATS = { totalLayers: 100, totalVariables: 14, totalStyles: 6 };
const PLAN_SCALE = 1.6;

export function buildDemo(): { init: unknown } {
  const components: ComponentInfo[] = COMPONENTS.map((c, i) => {
    const expected = c.kind === "button" ? ["default", "hover", "pressed", "focus", "disabled"] : c.kind === "input" ? ["default", "focus", "error", "disabled"] : [];
    const have = expected.slice(0, Math.max(1, expected.length - (i % 3)));
    return {
      id: `c${i}`, name: c.name, type: c.variants > 1 ? "COMPONENT_SET" : "COMPONENT", pageId: "0:1", pageName: i < 14 ? "Inputs & Actions" : "Display & Feedback",
      description: c.docs ? "Usage: when to use. Do: keep labels short. Don't: nest. Accessibility: a11y notes." : "", variantCount: c.variants, variants: [],
      propertyDefinitions: ["Size", "State"], isDeprecated: c.name.includes("deprecated"), hasDocumentation: c.docs, detectedKind: c.kind,
      detectedStates: have, missingStates: expected.filter((s) => !have.includes(s))
    };
  });

  const issues: Issue[] = [];
  let seq = 0;
  for (const [ruleId, count] of PLAN) {
    const r = rule(ruleId);
    for (let k = 0; k < Math.max(1, Math.round(count * PLAN_SCALE)); k++) {
      const c = ruleId === "deprecated-flagged" || ruleId === "governance-legacy-naming" ? components[components.length - 1] : pick(components);
      const g = GEN[ruleId](c);
      const severity = ruleId === "contrast-text-aa" ? (rand() < 0.45 ? "critical" : "warning") : r.severity;
      issues.push({
        id: `${ruleId}-${++seq}`, ruleId, category: r.category, severity, title: r.title, description: g.description, whyItMatters: r.whyItMatters,
        recommendation: r.recommendation({ message: g.description, meta: { threshold: 4.5, property: "color", label: "padding top" } }),
        estimatedImpact: severity === "critical" ? "high" : ruleId.startsWith("tokens-hardcoded-color") ? "medium" : "low", estimatedEffort: "low",
        reference: r.reference, node: nodeFor(c, "Layer"), status: "open"
      });
    }
  }
  // Tokens-level (no node) findings
  for (const [id, n, msg] of [
    ["tokens-unused-variable", 8, (i: number) => `Variable "color/legacy/accent-${i + 1}" is not referenced by any bound property in the audited components (usage outside these components is not visible to this scan).`],
    ["tokens-duplicate-variable", 4, (i: number) => `"color/gray/${200 + i * 100}" and "color/neutral/${i + 2}" resolve to the same value in every mode.`]
  ] as [string, number, (i: number) => string][]) {
    const r = rule(id);
    for (let k = 0; k < n; k++) {
      issues.push({ id: `${id}-${++seq}`, ruleId: id, category: r.category, severity: r.severity, title: r.title, description: msg(k), whyItMatters: r.whyItMatters,
        recommendation: r.recommendation({ message: "", meta: { a: "color/gray/200", b: "color/neutral/2" } }), estimatedImpact: "low", estimatedEffort: "low",
        collection: "Colors", discriminator: msg(k), status: "open" });
    }
  }
  // a few already-resolved issues so the list shows real workflow state
  issues.filter((i) => i.ruleId === "tokens-hardcoded-color").slice(0, 3).forEach((i) => (i.status = "resolved"));

  const denominators = Object.fromEntries(AUDIT_CATEGORIES.map((c) => [c, 0])) as Record<AuditCategory, number>;
  // Same formulas as scanner/scanEngine.ts buildDenominators: layers/25 for layer-level categories,
  // the component count for component-level ones, variables + styles for tokens.
  const nodeDen = Math.round(STATS.totalLayers / 25), compDen = COMPONENTS.length, tokenDen = STATS.totalVariables + STATS.totalStyles;
  Object.assign(denominators, { accessibility: nodeDen, contrast: nodeDen, visual: nodeDen, typography: nodeDen, spacing: nodeDen, components: compDen, states: compDen, documentation: compDen, governance: compDen, tokens: tokenDen, deprecated: compDen });
  const health = computeHealthScore(issues.filter((i) => i.status === "open"), denominators);

  const variables: VariableInfo[] = ["color/brand/primary", "color/text/default", "color/surface/raised", "space/200", "radius/md"].map((name, i) => ({
    id: `v${i}`, name, collectionId: "col", collectionName: "Foundations", resolvedType: i < 3 ? "COLOR" : "FLOAT", isAlias: i % 2 === 0, usageCount: 0
  }));

  const result: ScanResult = {
    scannedAt: "2026-10-04T10:30:00.000Z", fileName: "Northwind Design System (demo)",
    stats: { totalComponents: components.filter((c) => c.type === "COMPONENT").length, totalComponentSets: components.filter((c) => c.type === "COMPONENT_SET").length, totalVariants: components.reduce((n, c) => n + (c.type === "COMPONENT_SET" ? c.variantCount : 0), 0), totalVariables: STATS.totalVariables, totalTokens: STATS.totalVariables + STATS.totalStyles, totalLayers: STATS.totalLayers, totalStyles: STATS.totalStyles, deprecatedComponents: 1, scanDurationMs: 2300 },
    tokenStats: { totalVariables: STATS.totalVariables, totalCollections: 3, totalStyles: STATS.totalStyles, hardcodedColorCount: 64, hardcodedTypographyCount: 22, hardcodedSpacingCount: 16, hardcodedRadiusCount: 18, hardcodedShadowCount: 0, hardcodedOpacityCount: 9, unusedVariableCount: 8, duplicateVariableCount: 4, brokenAliasCount: 0 },
    health, issues, components, variables
  };

  // A believable climb over four earlier scans ending at the computed score.
  const end = health.overall;
  const trend: TrendEntry[] = [-17, -11, -6, 0].map((d, i) => {
    const overall = Math.max(0, end + d);
    return { scannedAt: `2026-09-${10 + i * 6}T10:00:00.000Z`, overall,
      // Each category moved by its own amount between scans (not one uniform offset), so the badges look like real data.
      categories: Object.fromEntries(health.categories.map((c) => [c.category, Math.max(0, Math.min(100, c.score + d + Math.round((rand() - 0.5) * 8)))])) as TrendEntry["categories"],
      totalCritical: Math.max(0, health.totalCritical - d / 2), totalWarnings: health.totalWarnings - d, totalSuggestions: health.totalSuggestions - d };
  });
  trend[trend.length - 1] = { ...trend[trend.length - 1], overall: end };

  return { init: { type: "init", settings: { wcagLevel: "AA" }, result, trend } };
}
