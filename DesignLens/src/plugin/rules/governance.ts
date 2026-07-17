import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef } from "./helpers";

const LEGACY_MARKERS = [/^old[\s_-]/i, /^copy of/i, /\bv1\b/i, /\btemp\b/i, /^untitled/i, /\bwip\b/i];

const legacyNamingRule: AuditRule = {
  id: "governance-legacy-naming",
  category: "governance",
  title: "Legacy or placeholder naming",
  description: "Component name carries a legacy/placeholder marker such as \"Copy of\", \"old_\", or \"WIP\".",
  whyItMatters:
    "Placeholder names leak into published libraries and signal to consumers that the component isn't production-ready, or worse, get adopted anyway.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (LEGACY_MARKERS.some((re) => re.test(record.info.name))) {
        findings.push({
          node: componentRef(record),
          message: `"${record.info.name}" carries a legacy/placeholder naming marker.`,
          severity: "warning",
          impact: "medium",
          effort: "low"
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Rename to the final, production naming convention and remove any placeholder markers before publishing.";
  }
};

const duplicateNameRule: AuditRule = {
  id: "governance-duplicate-name",
  category: "governance",
  title: "Duplicate component name",
  description: "Two components or component sets share the exact same name.",
  whyItMatters: "Duplicate names make it ambiguous which component to insert, and usually indicate an unintentional fork.",
  severity: "critical",
  evaluate(context: RuleContext): RuleFinding[] {
    const byName = new Map<string, typeof context.components>();
    for (const record of context.components) {
      const list = byName.get(record.info.name) ?? [];
      list.push(record);
      byName.set(record.info.name, list);
    }
    const findings: RuleFinding[] = [];
    for (const [name, records] of byName) {
      if (records.length > 1) {
        for (const record of records) {
          findings.push({
            node: componentRef(record),
            message: `"${name}" is used by ${records.length} separate components (pages: ${records
              .map((r) => r.info.pageName)
              .join(", ")}).`,
            severity: "critical",
            impact: "high",
            effort: "medium"
          });
        }
      }
    }
    return findings;
  },
  recommendation() {
    return "Rename to disambiguate, or consolidate into a single component if these are true duplicates.";
  }
};

const namingConventionRule: AuditRule = {
  id: "governance-naming-convention",
  category: "governance",
  title: "Inconsistent top-level naming convention",
  description: "Component naming mixes slash-namespaced names (e.g. \"Button/Primary\") with flat names inconsistently.",
  whyItMatters:
    "A mixed naming convention breaks the assets panel's grouping and makes the library harder to browse and search.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    if (context.components.length < 4) return [];
    const namespaced = context.components.filter((r) => r.info.name.includes("/"));
    const flat = context.components.filter((r) => !r.info.name.includes("/"));
    if (namespaced.length === 0 || flat.length === 0) return [];
    const minority = namespaced.length < flat.length ? namespaced : flat;
    const style = namespaced.length < flat.length ? "slash-namespaced" : "flat";
    return minority.map((record) => ({
      node: componentRef(record),
      message: `"${record.info.name}" uses a ${style} naming style while most of the library uses the opposite convention.`,
      severity: "suggestion" as const,
      impact: "low" as const,
      effort: "low" as const
    }));
  },
  recommendation() {
    return "Align this component's name with the library's dominant naming convention (either consistently slash-namespaced or consistently flat).";
  }
};

const PLACEHOLDER_COLLECTION_NAMES = /^(collection\s*\d*|untitled.*|new collection.*)$/i;

const collectionNamingRule: AuditRule = {
  id: "governance-collection-naming",
  category: "governance",
  title: "Placeholder variable collection name",
  description: "A variable collection still has Figma's default placeholder name.",
  whyItMatters: "An unnamed collection ('Collection 1') gives consumers no signal about what tokens live inside it — collections should be named for their purpose (Primitives, Semantic, Component).",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    return context.variableCollections
      .filter((c) => PLACEHOLDER_COLLECTION_NAMES.test(c.name.trim()))
      .map((c) => ({
        message: `Variable collection "${c.name}" still has a placeholder name.`,
        severity: "warning" as const,
        impact: "medium" as const,
        effort: "low" as const,
        collection: c.name
      }));
  },
  recommendation() {
    return "Rename the collection to describe what it contains (e.g. \"Primitives\", \"Semantic Colors\", \"Component Tokens\").";
  }
};

const variableNamingConventionRule: AuditRule = {
  id: "governance-variable-naming",
  category: "governance",
  title: "Inconsistent variable naming convention",
  description: "Variable naming mixes hierarchical slash names (e.g. \"color/text/primary\") with flat names within the same collection.",
  whyItMatters: "A mixed naming convention inside one collection makes the variables panel's grouping unpredictable and complicates any tooling that parses variable names for semantic meaning.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const byCollection = new Map<string, Variable[]>();
    for (const v of context.variables) {
      const list = byCollection.get(v.variableCollectionId) ?? [];
      list.push(v);
      byCollection.set(v.variableCollectionId, list);
    }

    for (const [collectionId, vars] of byCollection) {
      if (vars.length < 4) continue;
      const collectionName = context.variableCollections.find((c) => c.id === collectionId)?.name;
      const namespaced = vars.filter((v) => v.name.includes("/"));
      const flat = vars.filter((v) => !v.name.includes("/"));
      if (namespaced.length === 0 || flat.length === 0) continue;
      const minority = namespaced.length < flat.length ? namespaced : flat;
      const style = namespaced.length < flat.length ? "slash-namespaced" : "flat";
      for (const v of minority) {
        findings.push({
          message: `Variable "${v.name}" uses a ${style} naming style while most of "${collectionName}" uses the opposite convention.`,
          severity: "suggestion",
          impact: "low",
          effort: "low",
          collection: collectionName
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Rename to match the collection's dominant naming convention, ideally a consistent hierarchical scheme (group/subgroup/name).";
  }
};

export const governanceRules: AuditRule[] = [
  legacyNamingRule,
  duplicateNameRule,
  namingConventionRule,
  collectionNamingRule,
  variableNamingConventionRule
];
