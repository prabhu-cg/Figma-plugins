import type { AuditRule, RuleContext, RuleFinding } from "./types";
import {
  compositeOnBackground,
  contrastRatio,
  findAncestorBackground,
  findFirstSolidFill,
  isLargeText,
  WCAG_THRESHOLDS
} from "../color/contrast";
import { toNodeRef } from "./helpers";

const textContrastRule: AuditRule = {
  id: "contrast-text-aa",
  category: "contrast",
  title: "Text contrast below WCAG minimum",
  description: "Text color does not meet the configured WCAG contrast level against its background.",
  whyItMatters:
    "Low-contrast text is unreadable for users with low vision or color vision deficiencies, and fails automated accessibility audits before it ever ships to production.",
  severity: "critical",
  reference: "WCAG 2.1 SC 1.4.3 Contrast (Minimum)",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const thresholds = WCAG_THRESHOLDS[context.wcagLevel];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const textNodes = variant.findAll((n) => n.type === "TEXT") as TextNode[];
        for (const text of textNodes) {
          if (text.fontSize === figma.mixed || text.fontName === figma.mixed) continue;
          const fg = findFirstSolidFill(text);
          if (!fg) continue;
          const bg = findAncestorBackground(text);
          const rendered = compositeOnBackground(
            (text.fills !== figma.mixed ? (text.fills as Paint[]) : []).filter((p) => p.type === "SOLID"),
            bg
          );
          const ratio = contrastRatio(rendered, bg);
          const fontSize = text.fontSize as number;
          const style = (text.fontName as FontName).style.toLowerCase();
          const bold = style.includes("bold") || style.includes("black") || style.includes("heavy");
          const large = isLargeText(fontSize, bold ? 700 : 400);
          const threshold = large ? thresholds.largeText : thresholds.normalText;

          if (ratio < threshold) {
            findings.push({
              node: toNodeRef(text, record.info.id, record.info.name),
              message: `"${text.characters.slice(0, 40)}" in ${record.info.name} has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${threshold}:1 ${context.wcagLevel} minimum for ${large ? "large" : "normal"} text.`,
              severity: ratio < threshold * 0.7 ? "critical" : "warning",
              impact: "high",
              effort: "low",
              meta: { ratio: round2(ratio), threshold, componentId: record.info.id }
            });
          }
        }
      }
      if (context.isCancelled()) break;
    }

    return findings;
  },
  recommendation(finding) {
    return `Increase text color contrast or darken the background so the ratio meets ${finding.meta?.threshold ?? 4.5}:1. Try a darker text token, a heavier font weight, or a lighter surface color.`;
  }
};

const nonTextContrastRule: AuditRule = {
  id: "contrast-ui-component",
  category: "contrast",
  title: "UI component contrast below WCAG minimum",
  description: "A non-text UI element's border does not meet the 3:1 minimum contrast for graphical objects.",
  whyItMatters:
    "Input borders and control boundaries need enough contrast to be perceivable — otherwise users can't tell where one element ends and another begins.",
  severity: "warning",
  reference: "WCAG 2.1 SC 1.4.11 Non-text Contrast",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const thresholds = WCAG_THRESHOLDS[context.wcagLevel];
    const kindsToCheck = new Set(["button", "input", "checkbox", "radio", "switch", "badge", "alert", "card"]);

    for (const record of context.components) {
      if (!kindsToCheck.has(record.info.detectedKind ?? "unknown")) continue;
      for (const variant of record.variantNodes) {
        if (!("strokes" in variant)) continue;
        const strokes = (variant.strokes as Paint[]).filter((p) => p.type === "SOLID" && p.visible !== false);
        if (strokes.length === 0) continue;
        const bg = findAncestorBackground(variant);
        const strokeColor = compositeOnBackground(strokes, bg);
        const ratio = contrastRatio(strokeColor, bg);
        if (ratio < thresholds.uiComponent) {
          findings.push({
            node: toNodeRef(variant, record.info.id, record.info.name),
            message: `Border on ${variant.name} (${record.info.name}) has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${thresholds.uiComponent}:1 minimum for UI components.`,
            severity: "warning",
            impact: "medium",
            effort: "low",
            meta: { ratio: round2(ratio) }
          });
        }
      }
      if (context.isCancelled()) break;
    }

    return findings;
  },
  recommendation() {
    return "Darken the border/stroke color or increase contrast against the surrounding surface to reach at least 3:1.";
  }
};

const iconContrastRule: AuditRule = {
  id: "contrast-icon",
  category: "contrast",
  title: "Icon fill contrast below WCAG minimum",
  description: "A standalone icon's fill color does not meet the 3:1 minimum contrast for graphical objects.",
  whyItMatters: "Icons that communicate meaning (not purely decorative) need to be perceivable against their background just like text does.",
  severity: "warning",
  reference: "WCAG 2.1 SC 1.4.11 Non-text Contrast",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    const thresholds = WCAG_THRESHOLDS[context.wcagLevel];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const icons = variant.findAll((n) => n.name.toLowerCase().includes("icon") && n.type !== "TEXT") as SceneNode[];
        for (const icon of icons) {
          const fg = findFirstSolidFill(icon);
          if (!fg) continue;
          const bg = findAncestorBackground(icon);
          const ratio = contrastRatio(fg, bg);
          if (ratio < thresholds.uiComponent) {
            findings.push({
              node: toNodeRef(icon, record.info.id, record.info.name),
              message: `Icon "${icon.name}" in ${record.info.name} has a contrast ratio of ${ratio.toFixed(2)}:1, below the ${thresholds.uiComponent}:1 minimum.`,
              severity: "warning",
              impact: "medium",
              effort: "low",
              meta: { ratio: round2(ratio) }
            });
          }
        }
      }
      if (context.isCancelled()) break;
    }

    return findings;
  },
  recommendation() {
    return "Darken the icon fill or lighten its background, or confirm this icon is purely decorative and can be excluded from the contrast requirement.";
  }
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export const contrastRules: AuditRule[] = [textContrastRule, nonTextContrastRule, iconContrastRule];
