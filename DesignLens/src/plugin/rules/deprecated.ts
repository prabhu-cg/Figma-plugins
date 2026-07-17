import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef } from "./helpers";

const flaggedDeprecatedRule: AuditRule = {
  id: "deprecated-flagged",
  category: "deprecated",
  title: "Component flagged as deprecated",
  description: "Component name or description marks it as deprecated, legacy, or obsolete.",
  whyItMatters: "Deprecated components left in the published library keep getting inserted by consumers who don't notice the marker.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    return context.components
      .filter((r) => r.info.isDeprecated)
      .map((r) => {
        const usageCount = context.instanceCounts.get(r.info.id) ?? 0;
        return {
          node: componentRef(r),
          message: `"${r.info.name}" is marked deprecated and still has ${usageCount} instance${usageCount === 1 ? "" : "s"} in this file.`,
          severity: usageCount > 0 ? ("critical" as const) : ("warning" as const),
          impact: "high" as const,
          effort: "high" as const,
          meta: { usageCount }
        };
      });
  },
  recommendation(finding) {
    const count = finding.meta?.usageCount ?? 0;
    return count && Number(count) > 0
      ? "Migrate remaining instances to the replacement component before removing this one, then archive it in a deprecated/ page."
      : "No instances found in this file — safe to archive or delete after confirming no other files in the library depend on it.";
  }
};

const unusedComponentRule: AuditRule = {
  id: "deprecated-unused-component",
  category: "deprecated",
  title: "Component not instantiated anywhere in this file",
  description: "No instance of this component was found while scanning the file.",
  whyItMatters:
    "Components with zero visible usage are candidates for archiving — keeping them published adds noise to the picker without proven value. (This only reflects usage within the current file, not other files consuming the library.)",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    return context.components
      .filter((r) => !r.info.isDeprecated && (context.instanceCounts.get(r.info.id) ?? 0) === 0)
      .map((r) => ({
        node: componentRef(r),
        message: `"${r.info.name}" has no instances in this file.`,
        severity: "suggestion" as const,
        impact: "low" as const,
        effort: "low" as const
      }));
  },
  recommendation() {
    return "Confirm this component isn't consumed by other files before archiving — cross-file usage isn't visible to a single-file scan.";
  }
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(deprecated\)|\[deprecated\]|deprecated|legacy|obsolete/gi, "")
    .replace(/\bv\d+\b/gi, "")
    .replace(/^copy of\s*/i, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

const replacementSuggestionRule: AuditRule = {
  id: "deprecated-replacement-suggestion",
  category: "deprecated",
  title: "Likely replacement component found",
  description: "A deprecated component's name closely matches an active component, suggesting a migration target.",
  whyItMatters: "Naming the replacement in the deprecation notice turns a dead-end warning into an actionable migration path.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const active = context.components.filter((r) => !r.info.isDeprecated);
    const findings: RuleFinding[] = [];

    for (const deprecated of context.components) {
      if (!deprecated.info.isDeprecated) continue;
      const base = normalizeName(deprecated.info.name);
      if (base.length < 2) continue;
      const match = active.find((r) => normalizeName(r.info.name) === base && r.info.id !== deprecated.info.id);
      if (match) {
        findings.push({
          node: componentRef(deprecated),
          message: `"${deprecated.info.name}" looks like an older version of "${match.info.name}".`,
          severity: "suggestion",
          impact: "medium",
          effort: "low",
          meta: { replacement: match.info.name }
        });
      }
    }
    return findings;
  },
  recommendation(finding) {
    return `Point consumers to "${finding.meta?.replacement}" in the deprecation notice, then migrate remaining instances to it.`;
  }
};

export const deprecatedRules: AuditRule[] = [flaggedDeprecatedRule, unusedComponentRule, replacementSuggestionRule];
