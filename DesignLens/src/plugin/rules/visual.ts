import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { toNodeRef } from "./helpers";

const COMMON_ICON_SIZES = new Set([12, 16, 20, 24, 28, 32, 40, 48]);

const iconSizeConsistencyRule: AuditRule = {
  id: "visual-icon-size-inconsistency",
  category: "visual",
  title: "Icon size off the standard scale",
  description: "An icon-named layer doesn't match any size in the library's common icon scale, or isn't square.",
  whyItMatters: "Off-scale icons look mismatched next to standard-size icons and usually mean the SVG was placed without resizing to the grid.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const icons = variant.findAll(
          (n) => n.name.toLowerCase().includes("icon") && ("width" in n) && n.type !== "TEXT"
        ) as SceneNode[];
        for (const icon of icons) {
          const w = Math.round(icon.width);
          const h = Math.round(icon.height);
          const notSquare = Math.abs(w - h) > 1;
          const offScale = !COMMON_ICON_SIZES.has(w) || !COMMON_ICON_SIZES.has(h);
          if (notSquare || offScale) {
            findings.push({
              node: toNodeRef(icon, record.info.id, record.info.name),
              message: `Icon "${icon.name}" in ${record.info.name} is ${w}x${h}px${notSquare ? " (not square)" : ", off the standard icon scale"}.`,
              severity: "suggestion",
              impact: "low",
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
    return "Resize to a standard icon size (16/20/24/32px) and keep the bounding box square.";
  }
};

const strokeConsistencyRule: AuditRule = {
  id: "visual-stroke-weight-inconsistency",
  category: "visual",
  title: "Stroke weight outside common values",
  description: "Border weight doesn't match the small set of stroke widths used elsewhere in the library.",
  whyItMatters: "Arbitrary stroke weights create visual noise — borders should read as one of a small number of deliberate weights (hairline, default, emphasis).",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const weightCounts = new Map<number, number>();
    const perNode: { node: SceneNode; weight: number; componentId: string; componentName: string }[] = [];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const withStrokes = [variant, ...variant.findAll(() => true)].filter(
          (n) => "strokeWeight" in n && (n as MinimalStrokesMixin).strokes.length > 0
        ) as SceneNode[];
        for (const node of withStrokes) {
          const weight = (node as MinimalStrokesMixin).strokeWeight;
          if (typeof weight !== "number" || weight === 0) continue;
          weightCounts.set(weight, (weightCounts.get(weight) ?? 0) + 1);
          perNode.push({ node, weight, componentId: record.info.id, componentName: record.info.name });
        }
      }
    }

    if (weightCounts.size <= 3) return [];
    const commonWeights = new Set(
      Array.from(weightCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([w]) => w)
    );

    return perNode
      .filter((entry) => !commonWeights.has(entry.weight))
      .map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.name}" in ${entry.componentName} uses a ${entry.weight}px stroke, outside the library's ${Array.from(commonWeights).join("/")}px common weights.`,
        severity: "suggestion" as const,
        impact: "low" as const,
        effort: "low" as const
      }));
  },
  recommendation() {
    return "Standardize on the library's common stroke weights instead of introducing a new one-off value.";
  }
};

const cornerRadiusConsistencyRule: AuditRule = {
  id: "visual-corner-radius-inconsistency",
  category: "visual",
  title: "Corner radius outside common values",
  description: "Corner radius doesn't match the small set of radii used elsewhere in the library.",
  whyItMatters: "A handful of deliberate radius steps (e.g. 0/4/8/full) reads as a coherent shape language; one-off radii look like an accident.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const radiusCounts = new Map<number, number>();
    const perNode: { node: SceneNode; radius: number; componentId: string; componentName: string }[] = [];

    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const withRadius = [variant, ...variant.findAll(() => true)].filter((n) => "cornerRadius" in n) as SceneNode[];
        for (const node of withRadius) {
          const radius = (node as unknown as CornerMixin).cornerRadius;
          if (typeof radius !== "number" || radius <= 0) continue;
          radiusCounts.set(radius, (radiusCounts.get(radius) ?? 0) + 1);
          perNode.push({ node, radius, componentId: record.info.id, componentName: record.info.name });
        }
      }
    }

    if (radiusCounts.size <= 3) return [];
    const commonRadii = new Set(
      Array.from(radiusCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([r]) => r)
    );

    return perNode
      .filter((entry) => !commonRadii.has(entry.radius))
      .map((entry) => ({
        node: toNodeRef(entry.node, entry.componentId, entry.componentName),
        message: `"${entry.node.name}" in ${entry.componentName} uses a ${entry.radius}px corner radius, outside the library's common ${Array.from(commonRadii).sort((a, b) => a - b).join("/")}px radii.`,
        severity: "suggestion" as const,
        impact: "low" as const,
        effort: "low" as const
      }));
  },
  recommendation() {
    return "Standardize on one of the library's common radius steps instead of introducing a new one-off value.";
  }
};

export const visualRules: AuditRule[] = [iconSizeConsistencyRule, strokeConsistencyRule, cornerRadiusConsistencyRule];
