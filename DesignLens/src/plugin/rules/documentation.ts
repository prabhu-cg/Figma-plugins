import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef } from "./helpers";

interface SectionCheck {
  key: string;
  label: string;
  patterns: RegExp[];
}

const EXPECTED_SECTIONS: SectionCheck[] = [
  { key: "usage", label: "Usage", patterns: [/usage/i, /when to use/i] },
  { key: "do", label: "Do", patterns: [/\bdo:/i, /\bdo\b/i] },
  { key: "dont", label: "Don't", patterns: [/don'?t/i, /avoid/i] },
  { key: "accessibility", label: "Accessibility", patterns: [/a11y/i, /accessib/i] }
];

const incompleteDocumentationRule: AuditRule = {
  id: "docs-incomplete-sections",
  category: "documentation",
  title: "Documentation missing expected sections",
  description: "A description exists but is missing recommended sections (usage, do/don't, accessibility notes).",
  whyItMatters:
    "Partial documentation gives a false sense of coverage — teams see a description exists and assume guidance is complete, then miss the do/don't and accessibility context that prevents misuse.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (!record.info.hasDocumentation) continue;
      const text = record.info.description;
      const missing = EXPECTED_SECTIONS.filter((s) => !s.patterns.some((p) => p.test(text)));
      if (missing.length > 0) {
        findings.push({
          node: componentRef(record),
          message: `${record.info.name}'s description is missing: ${missing.map((m) => m.label).join(", ")}.`,
          severity: "suggestion",
          impact: "low",
          effort: "medium",
          meta: { missing: missing.map((m) => m.key).join(",") }
        });
      }
    }
    return findings;
  },
  recommendation(finding) {
    return `Extend the description to cover: ${finding.meta?.missing}. Keep each section short and link out to full docs if you have a site.`;
  }
};

const undocumentedPropertiesRule: AuditRule = {
  id: "docs-undocumented-properties",
  category: "documentation",
  title: "Variant properties not explained in the description",
  description: "Component exposes variant properties that are never mentioned in its description.",
  whyItMatters: "Consumers picking between properties they don't understand tend to misuse them or duplicate the component instead.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (record.info.propertyDefinitions.length === 0) continue;
      const text = record.info.description.toLowerCase();
      const unmentioned = record.info.propertyDefinitions.filter((p) => {
        const base = p.split("#")[0].toLowerCase();
        return !text.includes(base);
      });
      if (unmentioned.length > 0 && record.info.hasDocumentation) {
        findings.push({
          node: componentRef(record),
          message: `${record.info.name} has properties not referenced in its description: ${unmentioned
            .map((p) => p.split("#")[0])
            .join(", ")}.`,
          severity: "suggestion",
          impact: "low",
          effort: "low"
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Mention each property and its accepted values in the description so consumers know what's configurable.";
  }
};

export const documentationRules: AuditRule[] = [incompleteDocumentationRule, undocumentedPropertiesRule];
