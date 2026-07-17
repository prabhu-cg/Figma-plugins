import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef, toNodeRef } from "./helpers";

const MAX_COMBINATION_SPACE = 200;

function cartesianProduct(valuesByProp: [string, string[]][]): Record<string, string>[] {
  return valuesByProp.reduce<Record<string, string>[]>(
    (acc, [prop, values]) => acc.flatMap((combo) => values.map((value) => ({ ...combo, [prop]: value }))),
    [{}]
  );
}

function comboKey(combo: Record<string, string>): string {
  return JSON.stringify(Object.entries(combo).sort());
}

const missingDescriptionRule: AuditRule = {
  id: "components-missing-description",
  category: "components",
  title: "Component missing a description",
  description: "Component or component set has no description set.",
  whyItMatters:
    "Without a description, consumers of the library have to guess intended usage, which leads to misuse and inconsistent adoption.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    return context.components
      .filter((r) => !r.info.hasDocumentation)
      .map((r) => ({
        node: componentRef(r),
        message: `"${r.info.name}" has no description.`,
        severity: "warning" as const,
        impact: "medium" as const,
        effort: "low" as const
      }));
  },
  recommendation() {
    return "Add a description covering purpose, usage guidance, and when not to use this component.";
  }
};

const duplicateVariantRule: AuditRule = {
  id: "components-duplicate-variant",
  category: "components",
  title: "Duplicate variant properties",
  description: "Two variants within the same component set share identical property values.",
  whyItMatters: "Duplicate variants are confusing to pick between and usually indicate a cleanup was left unfinished.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (record.info.type !== "COMPONENT_SET") continue;
      const seen = new Map<string, string>();
      for (const variant of record.info.variants) {
        const key = JSON.stringify(Object.entries(variant.properties).sort());
        if (seen.has(key)) {
          findings.push({
            node: componentRef(record),
            message: `"${variant.name}" duplicates the property values of "${seen.get(key)}" in ${record.info.name}.`,
            severity: "warning",
            impact: "medium",
            effort: "medium"
          });
        } else {
          seen.set(key, variant.name);
        }
      }
    }
    return findings;
  },
  recommendation() {
    return "Remove or differentiate the duplicate variant so each combination of properties maps to exactly one variant.";
  }
};

const inconsistentPropertyNamingRule: AuditRule = {
  id: "components-inconsistent-property-naming",
  category: "components",
  title: "Inconsistent variant property naming",
  description: "The same conceptual property is named with different casing across component sets.",
  whyItMatters:
    "Inconsistent property names (e.g. \"Size\" vs \"size\") make the API of the library unpredictable and complicate codegen/Code Connect mappings.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const canonicalToVariants = new Map<string, Map<string, string[]>>();
    for (const record of context.components) {
      for (const prop of record.info.propertyDefinitions) {
        const base = prop.split("#")[0];
        const canonical = base.toLowerCase();
        if (!canonicalToVariants.has(canonical)) canonicalToVariants.set(canonical, new Map());
        const variantsMap = canonicalToVariants.get(canonical)!;
        if (!variantsMap.has(base)) variantsMap.set(base, []);
        variantsMap.get(base)!.push(record.info.name);
      }
    }

    const findings: RuleFinding[] = [];
    for (const [canonical, variantsMap] of canonicalToVariants) {
      if (variantsMap.size > 1) {
        const spellings = Array.from(variantsMap.entries());
        findings.push({
          message: `Property "${canonical}" appears with ${variantsMap.size} different casings: ${spellings
            .map(([spelling, comps]) => `"${spelling}" (${comps.length} component${comps.length === 1 ? "" : "s"})`)
            .join(", ")}.`,
          severity: "suggestion",
          impact: "low",
          effort: "medium"
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Standardize on one casing/spelling for this property name across every component that exposes it.";
  }
};

const missingVariantCombinationRule: AuditRule = {
  id: "components-missing-variant-combination",
  category: "components",
  title: "Missing variant combination",
  description: "This component set doesn't cover every combination of its own variant property values.",
  whyItMatters:
    "Gaps in the variant matrix force engineers to compose properties Figma doesn't support, or fall back to a visually inconsistent default when the exact combination they need doesn't exist.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];

    for (const record of context.components) {
      if (record.info.type !== "COMPONENT_SET" || record.info.variants.length < 2) continue;
      const propNames = Object.keys(record.info.variants[0].properties);
      if (propNames.length === 0 || propNames.length > 5) continue;

      const valuesByProp: [string, string[]][] = propNames.map((prop) => [
        prop,
        Array.from(new Set(record.info.variants.map((v) => v.properties[prop]).filter((v): v is string => v !== undefined)))
      ]);
      const combinationSpace = valuesByProp.reduce((acc, [, values]) => acc * values.length, 1);
      if (combinationSpace > MAX_COMBINATION_SPACE || combinationSpace <= record.info.variants.length) continue;

      const existing = new Set(record.info.variants.map((v) => comboKey(v.properties)));
      const missing = cartesianProduct(valuesByProp).filter((combo) => !existing.has(comboKey(combo)));
      if (missing.length === 0) continue;

      const examples = missing
        .slice(0, 5)
        .map((combo) => Object.entries(combo).map(([k, v]) => `${k}=${v}`).join(", "))
        .join(" · ");

      findings.push({
        node: componentRef(record),
        message: `${record.info.name} is missing ${missing.length} of ${combinationSpace} possible variant combinations, e.g. ${examples}${missing.length > 5 ? "…" : ""}.`,
        severity: missing.length / combinationSpace > 0.3 ? "warning" : "suggestion",
        impact: "medium",
        effort: "high",
        meta: { missingCount: missing.length, total: combinationSpace }
      });
    }
    return findings;
  },
  recommendation() {
    return "Add the missing variant combinations, or confirm they're intentionally unsupported and document why in the component description.";
  }
};

const unusedVariantRule: AuditRule = {
  id: "components-unused-variant",
  category: "components",
  title: "Variant not instantiated anywhere in this file",
  description: "This specific variant has no instances, even though other variants in the same set are used.",
  whyItMatters:
    "An unused variant inside an otherwise-adopted component set is a strong candidate for pruning — keeping it adds picker noise without proven value.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (record.info.type !== "COMPONENT_SET" || record.variantNodes.length < 2) continue;
      for (const variant of record.variantNodes) {
        if ((context.variantInstanceCounts.get(variant.id) ?? 0) === 0) {
          findings.push({
            node: toNodeRef(variant, record.info.id, record.info.name),
            message: `Variant "${variant.name}" of ${record.info.name} has no instances in this file.`,
            severity: "suggestion",
            impact: "low",
            effort: "low"
          });
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return "Confirm this variant isn't consumed by other files before removing it — cross-file usage isn't visible to a single-file scan.";
  }
};

export const componentRules: AuditRule[] = [
  missingDescriptionRule,
  duplicateVariantRule,
  inconsistentPropertyNamingRule,
  missingVariantCombinationRule,
  unusedVariantRule
];
