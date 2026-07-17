import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef } from "./helpers";

const missingStatesRule: AuditRule = {
  id: "states-missing-expected",
  category: "states",
  title: "Missing expected interaction state",
  description: "This component type is expected to cover a state that has no matching variant.",
  whyItMatters:
    "Missing states force engineers to invent their own hover/focus/disabled treatment at implementation time, causing visual inconsistency between the design system and the shipped product.",
  severity: "warning",
  reference: "Design system best practice: cover Default/Hover/Focus/Disabled (and type-specific states) per interactive component",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (!record.info.detectedKind || record.info.detectedKind === "unknown") continue;
      if (record.info.missingStates.length === 0) continue;
      findings.push({
        node: componentRef(record),
        message: `${record.info.name} (detected as "${record.info.detectedKind}") is missing state${
          record.info.missingStates.length === 1 ? "" : "s"
        }: ${record.info.missingStates.join(", ")}.`,
        severity: record.info.variantCount <= 1 ? "critical" : "warning",
        impact: "high",
        effort: "medium",
        meta: { kind: record.info.detectedKind, missing: record.info.missingStates.join(",") }
      });
    }
    return findings;
  },
  recommendation(finding) {
    return `Add variant(s) covering: ${finding.meta?.missing}. Expose them as a "State" variant property so consumers can switch state without duplicating the component.`;
  }
};

export const stateRules: AuditRule[] = [missingStatesRule];
