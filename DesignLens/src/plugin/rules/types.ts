import type { AuditCategory, ComponentInfo, NodeRef, Severity, WcagLevel } from "@shared/types";

/** One collected component or component set, with direct node access for deep inspection by rules. */
export interface ComponentRecord {
  node: ComponentNode | ComponentSetNode;
  info: ComponentInfo;
  /** Individual variant nodes — for a COMPONENT_SET, its children; for a standalone COMPONENT, itself. */
  variantNodes: ComponentNode[];
}

export interface RuleContext {
  components: ComponentRecord[];
  variables: Variable[];
  variableCollections: VariableCollection[];
  paintStyles: PaintStyle[];
  textStyles: TextStyle[];
  effectStyles: EffectStyle[];
  gridStyles: GridStyle[];
  /** All descendant nodes across every audited component, flattened, for layer-level checks. */
  allComponentNodes: SceneNode[];
  /** Instance count per main component (or component-set) id, counted across all scanned pages. */
  instanceCounts: Map<string, number>;
  /** Instance count per exact variant (individual COMPONENT) id, for variant-level usage checks. */
  variantInstanceCounts: Map<string, number>;
  wcagLevel: WcagLevel;
  isCancelled: () => boolean;
}

/** A single instance of a problem (or pass) found by a rule during evaluate(). */
export interface RuleFinding {
  node?: NodeRef;
  message: string;
  severity?: Severity;
  impact?: "high" | "medium" | "low";
  effort?: "high" | "medium" | "low";
  /** Variable collection this finding relates to, if any — powers the Collection filter. */
  collection?: string;
  meta?: Record<string, string | number | boolean | undefined>;
}

/**
 * A self-contained, independently registerable audit check. New audits are added by
 * implementing this interface and calling registerRule() — the scan engine and registry
 * discover and run every registered rule without any change to core scanning logic.
 */
export interface AuditRule {
  id: string;
  category: AuditCategory;
  title: string;
  description: string;
  whyItMatters: string;
  severity: Severity;
  reference?: string;
  evaluate(context: RuleContext): RuleFinding[] | Promise<RuleFinding[]>;
  recommendation(finding: RuleFinding): string;
}
