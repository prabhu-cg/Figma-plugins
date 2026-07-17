import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { toNodeRef } from "./helpers";

const GRID_UNIT = 4;

function isOnGrid(value: number): boolean {
  return Math.abs(value % GRID_UNIT) < 0.01;
}

const missingAutoLayoutRule: AuditRule = {
  id: "spacing-missing-autolayout",
  category: "spacing",
  title: "Multi-child frame without Auto Layout",
  description: "A frame with multiple children does not use Auto Layout.",
  whyItMatters:
    "Without Auto Layout, spacing is positional and silently breaks when content, translations, or child count change — Auto Layout keeps spacing systematic and resilient.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const frames = variant.findAll(
          (n) => n.type === "FRAME" && (n as FrameNode).children.length >= 2
        ) as FrameNode[];
        for (const frame of frames) {
          if (frame.layoutMode === "NONE") {
            findings.push({
              node: toNodeRef(frame, record.info.id, record.info.name),
              message: `Frame "${frame.name}" in ${record.info.name} has ${frame.children.length} children but no Auto Layout.`,
              severity: "suggestion",
              impact: "medium",
              effort: "medium"
            });
          }
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return "Convert this frame to Auto Layout so spacing scales predictably with content changes.";
  }
};

const hardcodedSpacingRule: AuditRule = {
  id: "spacing-off-grid",
  category: "spacing",
  title: "Spacing value off the 4px/8pt grid",
  description: "Auto Layout padding or gap uses a value that isn't a multiple of the base spacing unit.",
  whyItMatters:
    "Off-grid spacing accumulates into inconsistent rhythm across a product and is a strong signal the value isn't bound to a spacing token.",
  severity: "warning",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const frames = variant.findAll((n) => n.type === "FRAME" && (n as FrameNode).layoutMode !== "NONE") as FrameNode[];
        for (const frame of frames) {
          const values: Array<[string, number]> = [
            ["padding top", frame.paddingTop],
            ["padding right", frame.paddingRight],
            ["padding bottom", frame.paddingBottom],
            ["padding left", frame.paddingLeft],
            ["item spacing", frame.itemSpacing]
          ];
          for (const [label, value] of values) {
            if (value !== 0 && !isOnGrid(value)) {
              findings.push({
                node: toNodeRef(frame, record.info.id, record.info.name),
                message: `${frame.name} in ${record.info.name} has ${label} of ${value}px, off the ${GRID_UNIT}px grid.`,
                severity: "warning",
                impact: "low",
                effort: "low",
                meta: { label, value }
              });
            }
          }
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation(finding) {
    return `Round "${finding.meta?.label}" to the nearest ${GRID_UNIT}px increment and bind it to a spacing variable.`;
  }
};

export const spacingRules: AuditRule[] = [missingAutoLayoutRule, hardcodedSpacingRule];
