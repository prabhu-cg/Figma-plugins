import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { componentRef, isInteractiveKind, toNodeRef } from "./helpers";

const MIN_TOUCH_TARGET = 44;
const MIN_TEXT_SIZE = 12;
const GENERIC_LAYER_NAMES = new Set(["vector", "ellipse", "rectangle", "path", "icon", "group", "frame"]);

const touchTargetRule: AuditRule = {
  id: "a11y-touch-target-size",
  category: "accessibility",
  title: "Touch target smaller than 44x44",
  description: "An interactive component's bounding box is smaller than the recommended minimum touch target size.",
  whyItMatters:
    "Small tap targets are hard to hit accurately for users with motor impairments and on touch devices generally — this is one of the most common mobile accessibility failures.",
  severity: "warning",
  reference: "WCAG 2.2 SC 2.5.8 Target Size (Minimum)",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (!isInteractiveKind(record.info.detectedKind)) continue;
      for (const variant of record.variantNodes) {
        if (variant.width < MIN_TOUCH_TARGET || variant.height < MIN_TOUCH_TARGET) {
          findings.push({
            node: toNodeRef(variant, record.info.id, record.info.name),
            message: `${variant.name} in ${record.info.name} is ${Math.round(variant.width)}x${Math.round(
              variant.height
            )}px, below the ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px minimum touch target.`,
            severity: "warning",
            impact: "high",
            effort: "medium"
          });
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return `Increase padding/hit area to at least ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}px, even if the visible control stays visually smaller.`;
  }
};

const minTextSizeRule: AuditRule = {
  id: "a11y-min-text-size",
  category: "accessibility",
  title: "Text below minimum readable size",
  description: "Text layer uses a font size smaller than the recommended readable minimum.",
  whyItMatters: "Very small text is difficult to read for low-vision users and fails many platform accessibility guidelines.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const textNodes = variant.findAll((n) => n.type === "TEXT") as TextNode[];
        for (const text of textNodes) {
          if (text.fontSize === figma.mixed) continue;
          const size = text.fontSize as number;
          if (size < MIN_TEXT_SIZE) {
            findings.push({
              node: toNodeRef(text, record.info.id, record.info.name),
              message: `"${text.characters.slice(0, 30)}" in ${record.info.name} is ${size}px, below the ${MIN_TEXT_SIZE}px readable minimum.`,
              severity: "suggestion",
              impact: "medium",
              effort: "low"
            });
          }
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return `Increase the font size to at least ${MIN_TEXT_SIZE}px, or confirm this is intentional caption/legal text with adequate contrast.`;
  }
};

const iconLabelRule: AuditRule = {
  id: "a11y-icon-without-label",
  category: "accessibility",
  title: "Icon-only element without an accessible name",
  description: "An icon-only interactive layer keeps its generic default name and has no description, so it likely has no accessible label downstream.",
  whyItMatters:
    "Screen reader users rely on accessible names for icon-only buttons and controls — a component named \"Vector 204\" with no description usually means engineering has no naming guidance to hand to their aria-label.",
  severity: "warning",
  reference: "WCAG 2.1 SC 4.1.2 Name, Role, Value",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      const nameLower = record.info.name.toLowerCase();
      const looksIconOnly = nameLower.includes("icon") && !nameLower.includes("button");
      if (!looksIconOnly) continue;
      const genericName = GENERIC_LAYER_NAMES.has(nameLower.trim());
      if ((genericName || record.info.name.match(/^(Vector|Ellipse|Rectangle|Icon)\s*\d*$/i)) && !record.info.hasDocumentation) {
        findings.push({
          node: componentRef(record),
          message: `"${record.info.name}" is an icon-only component with a generic name and no description to guide an accessible label.`,
          severity: "warning",
          impact: "medium",
          effort: "low"
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Rename the layer to describe its meaning (e.g. \"icon-close\") and add a description noting the aria-label/accessible name engineering should apply.";
  }
};

const hiddenLayerRule: AuditRule = {
  id: "a11y-hidden-layer",
  category: "accessibility",
  title: "Hidden layer left inside a component",
  description: "A layer inside this component is set to invisible.",
  whyItMatters:
    "Hidden layers are sometimes intentional (state toggles), but they're also frequently leftover debugging cruft that ships hidden content, unexpected spacing, or dead weight into every instance.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const hidden = variant.findAll((n) => "visible" in n && n.visible === false);
        for (const node of hidden) {
          findings.push({
            node: toNodeRef(node, record.info.id, record.info.name),
            message: `"${node.name}" in ${record.info.name} is hidden. Verify this is an intentional state layer.`,
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
    return "If this layer isn't used as a toggled state, remove it. If it is, note that in the component description so it isn't mistaken for cruft.";
  }
};

const focusVisibilityRule: AuditRule = {
  id: "a11y-focus-visibility",
  category: "accessibility",
  title: "Focus state has no visible focus indicator",
  description: "This component has a Focus variant, but it has no visible stroke to distinguish it from the default state.",
  whyItMatters:
    "A focus state that looks identical to default is invisible to keyboard users — the whole point of the state is to show where keyboard focus currently is.",
  severity: "critical",
  reference: "WCAG 2.2 SC 2.4.11 Focus Not Obscured / SC 1.4.11 Non-text Contrast",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      if (record.info.type !== "COMPONENT_SET" || !record.info.detectedStates.includes("focus")) continue;

      record.info.variants.forEach((variantInfo, i) => {
        const isFocusVariant = Object.values(variantInfo.properties).some((v) => v.toLowerCase() === "focus");
        if (!isFocusVariant) return;
        const node = record.variantNodes[i];
        if (!node || !("strokes" in node)) return;
        const hasVisibleStroke = (node.strokes as Paint[]).some((p) => p.type === "SOLID" && p.visible !== false);
        if (!hasVisibleStroke) {
          findings.push({
            node: toNodeRef(node, record.info.id, record.info.name),
            message: `The Focus variant of ${record.info.name} has no visible stroke/outline.`,
            severity: "critical",
            impact: "high",
            effort: "low"
          });
        }
      });
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return "Add a visible focus ring (stroke) to the Focus variant — don't rely on color/fill changes alone, which many keyboard/low-vision users won't perceive.";
  }
};

export const accessibilityRules: AuditRule[] = [
  touchTargetRule,
  minTextSizeRule,
  iconLabelRule,
  hiddenLayerRule,
  focusVisibilityRule
];
