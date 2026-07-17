// Domain and messaging contracts shared between the plugin sandbox (src/plugin)
// and the UI iframe (src/ui). Neither side imports Figma or DOM globals from here.

export type Severity = "critical" | "warning" | "suggestion";

export type WcagLevel = "AA" | "AAA";

export type IssueStatus = "open" | "resolved" | "ignored";

export type AuditCategory =
  | "visual"
  | "contrast"
  | "typography"
  | "spacing"
  | "tokens"
  | "components"
  | "states"
  | "accessibility"
  | "documentation"
  | "governance"
  | "deprecated";

export const AUDIT_CATEGORIES: AuditCategory[] = [
  "visual",
  "contrast",
  "typography",
  "spacing",
  "tokens",
  "components",
  "states",
  "accessibility",
  "documentation",
  "governance",
  "deprecated"
];

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  visual: "Visual",
  contrast: "Contrast",
  typography: "Typography",
  spacing: "Spacing",
  tokens: "Design Tokens",
  components: "Component Quality",
  states: "State Coverage",
  accessibility: "Accessibility",
  documentation: "Documentation",
  governance: "Governance",
  deprecated: "Deprecated"
};

export interface NodeRef {
  id: string;
  name: string;
  type: string;
  pageId: string;
  pageName: string;
  /** Component or component-set this node belongs to, if applicable. */
  componentId?: string;
  componentName?: string;
}

export interface Issue {
  id: string;
  ruleId: string;
  category: AuditCategory;
  severity: Severity;
  title: string;
  description: string;
  whyItMatters: string;
  recommendation: string;
  estimatedImpact: "high" | "medium" | "low";
  estimatedEffort: "high" | "medium" | "low";
  reference?: string;
  node?: NodeRef;
  /** Variable collection this issue relates to, if any — powers the Collection filter. */
  collection?: string;
  status: IssueStatus;
  meta?: Record<string, string | number | boolean | undefined>;
}

export interface CategoryScore {
  category: AuditCategory;
  score: number; // 0-100
  weight: number; // 0-1, contribution to overall health score
  criticalCount: number;
  warningCount: number;
  suggestionCount: number;
  passCount: number;
}

export interface HealthScore {
  overall: number;
  categories: CategoryScore[];
  totalCritical: number;
  totalWarnings: number;
  totalSuggestions: number;
  totalSuccesses: number;
}

export interface VariantInfo {
  id: string;
  name: string;
  properties: Record<string, string>;
}

export interface ComponentInfo {
  id: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  pageId: string;
  pageName: string;
  description: string;
  variantCount: number;
  variants: VariantInfo[];
  propertyDefinitions: string[];
  isDeprecated: boolean;
  hasDocumentation: boolean;
  detectedKind?: ComponentKind;
  detectedStates: string[];
  missingStates: string[];
}

export type ComponentKind =
  | "button"
  | "input"
  | "checkbox"
  | "radio"
  | "switch"
  | "select"
  | "tab"
  | "accordion"
  | "menu-item"
  | "link"
  | "card"
  | "badge"
  | "alert"
  | "icon"
  | "unknown";

export interface VariableInfo {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  resolvedType: string;
  isAlias: boolean;
  usageCount: number;
}

export interface TokenStats {
  totalVariables: number;
  totalCollections: number;
  totalStyles: number;
  hardcodedColorCount: number;
  hardcodedTypographyCount: number;
  hardcodedSpacingCount: number;
  hardcodedRadiusCount: number;
  hardcodedShadowCount: number;
  hardcodedOpacityCount: number;
  unusedVariableCount: number;
  duplicateVariableCount: number;
  brokenAliasCount: number;
}

export interface ScanStats {
  totalComponents: number;
  totalComponentSets: number;
  totalVariants: number;
  totalVariables: number;
  totalTokens: number;
  totalLayers: number;
  totalStyles: number;
  deprecatedComponents: number;
  scanDurationMs: number;
}

export interface ScanResult {
  scannedAt: string;
  fileName: string;
  stats: ScanStats;
  tokenStats: TokenStats;
  health: HealthScore;
  issues: Issue[];
  components: ComponentInfo[];
  variables: VariableInfo[];
}

/** A compact per-scan snapshot kept across sessions to power dashboard trend indicators. */
export interface TrendEntry {
  scannedAt: string;
  overall: number;
  categories: Record<AuditCategory, number>;
  totalCritical: number;
  totalWarnings: number;
  totalSuggestions: number;
}

export interface DesignLensSettings {
  wcagLevel: WcagLevel;
}

// ---- postMessage protocol -------------------------------------------------

export type UIToPluginMessage =
  | { type: "start-scan" }
  | { type: "cancel-scan" }
  | { type: "select-node"; nodeId: string }
  | { type: "set-wcag-level"; level: WcagLevel }
  | { type: "set-issue-status"; issueKey: string; status: IssueStatus };

export type PluginToUIMessage =
  | { type: "init"; settings: DesignLensSettings; result: ScanResult | null; trend: TrendEntry[] }
  | { type: "scan-progress"; phase: string; processed: number; total: number }
  | { type: "scan-complete"; result: ScanResult; trend: TrendEntry[] }
  | { type: "scan-cancelled" }
  | { type: "scan-error"; message: string };
