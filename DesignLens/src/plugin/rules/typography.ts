import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { toNodeRef } from "./helpers";

const hardcodedTypeRule: AuditRule = {
  id: "typography-hardcoded-style",
  category: "typography",
  title: "Text not using a shared text style",
  description: "Text layer has hand-set font properties instead of a linked text style.",
  whyItMatters:
    "Hardcoded typography drifts from the type scale over time and breaks silently when the design system updates its type ramp — every unlinked layer has to be found and fixed by hand.",
  severity: "warning",
  reference: "Design system best practice: single source of truth for type scale",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const textNodes = variant.findAll((n) => n.type === "TEXT") as TextNode[];
        for (const text of textNodes) {
          if (text.textStyleId !== "" && typeof text.textStyleId === "string") continue;
          if (text.textStyleId === figma.mixed) continue;
          findings.push({
            node: toNodeRef(text, record.info.id, record.info.name),
            message: `"${text.characters.slice(0, 30)}" in ${record.info.name} has no linked text style.`,
            severity: "warning",
            impact: "medium",
            effort: "low"
          });
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return "Apply a shared text style (or bind font family/size/weight/line-height to typography variables) instead of hand-set values.";
  }
};

const fontFamilyConsistencyRule: AuditRule = {
  id: "typography-family-consistency",
  category: "typography",
  title: "Inconsistent font family",
  description: "Component uses a font family that differs from the library's dominant font family.",
  whyItMatters:
    "Mixed font families inside a single design system usually indicate a copy-pasted layer from another file or an unintentional override, and they undermine visual consistency across products.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const familyCounts = new Map<string, number>();
    const perText: { node: TextNode; family: string; componentId: string; componentName: string }[] = [];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const textNodes = variant.findAll((n) => n.type === "TEXT") as TextNode[];
        for (const text of textNodes) {
          if (text.fontName === figma.mixed) continue;
          const family = (text.fontName as FontName).family;
          familyCounts.set(family, (familyCounts.get(family) ?? 0) + 1);
          perText.push({ node: text, family, componentId: record.info.id, componentName: record.info.name });
        }
      }
    }

    if (familyCounts.size <= 1) return [];
    const dominant = Array.from(familyCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
    const findings: RuleFinding[] = [];
    for (const entry of perText) {
      if (entry.family !== dominant) {
        findings.push({
          node: toNodeRef(entry.node, entry.componentId, entry.componentName),
          message: `${entry.componentName} uses "${entry.family}" while the library's dominant font is "${dominant}".`,
          severity: "suggestion",
          impact: "low",
          effort: "low",
          meta: { family: entry.family, dominant }
        });
      }
    }
    return findings;
  },
  recommendation(finding) {
    return `Switch to the library's dominant font family ("${finding.meta?.dominant}") unless this is an intentional secondary typeface.`;
  }
};

const unusedTextStyleRule: AuditRule = {
  id: "typography-unused-style",
  category: "typography",
  title: "Text style not used by any audited text layer",
  description: "This shared text style isn't linked from any text node within the scanned components.",
  whyItMatters:
    "Unused text styles bloat the type picker and make it unclear to consumers which styles are actually part of the current type scale.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const usedStyleIds = new Set<string>();
    for (const node of context.allComponentNodes) {
      if (node.type !== "TEXT") continue;
      const styleId = (node as TextNode).textStyleId;
      if (typeof styleId === "string" && styleId !== "") usedStyleIds.add(styleId);
    }

    return context.textStyles
      .filter((style) => !usedStyleIds.has(style.id))
      .map((style) => ({
        message: `Text style "${style.name}" is not referenced by any text layer in the audited components.`,
        severity: "suggestion" as const,
        impact: "low" as const,
        effort: "low" as const,
        meta: { styleName: style.name }
      }));
  },
  recommendation() {
    return "Confirm this style isn't used elsewhere in the file/library before removing it, then delete it to keep the type picker clean.";
  }
};

const COMMON_FONT_SIZES = new Set([10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64]);

const sizeScaleRule: AuditRule = {
  id: "typography-size-scale",
  category: "typography",
  title: "Font size off the standard type scale",
  description: "Text uses a font size that isn't part of the library's common type scale.",
  whyItMatters:
    "One-off font sizes fragment the type scale over time — a design system should have a small, deliberate set of sizes that every text style draws from.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const sizeCounts = new Map<number, number>();
    const perText: { node: TextNode; size: number; componentId: string; componentName: string }[] = [];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const textNodes = variant.findAll((n) => n.type === "TEXT") as TextNode[];
        for (const text of textNodes) {
          if (text.fontSize === figma.mixed) continue;
          const size = text.fontSize as number;
          sizeCounts.set(size, (sizeCounts.get(size) ?? 0) + 1);
          perText.push({ node: text, size, componentId: record.info.id, componentName: record.info.name });
        }
      }
    }

    if (sizeCounts.size <= 4) return [];
    const commonSizes = new Set(
      Array.from(sizeCounts.entries())
        .filter(([size]) => COMMON_FONT_SIZES.has(size))
        .map(([size]) => size)
    );
    if (commonSizes.size === 0) return [];

    return perText
      .filter((entry) => !commonSizes.has(entry.size))
      .map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.characters.slice(0, 30)}" in ${entry.componentName} uses ${entry.size}px, outside the library's common type scale.`,
        severity: "suggestion" as const,
        impact: "low" as const,
        effort: "low" as const
      }));
  },
  recommendation() {
    return "Round to the nearest size in the library's type scale, or add this size to the scale deliberately if it's a genuine new step.";
  }
};

export const typographyRules: AuditRule[] = [
  hardcodedTypeRule,
  fontFamilyConsistencyRule,
  unusedTextStyleRule,
  sizeScaleRule
];
