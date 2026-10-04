import type { AuditRule, RuleContext, RuleFinding } from "./types";
import { hasBoundVariableAt, hasStyleApplied, ownNodes, toNodeRef } from "./helpers";

const hardcodedColorRule: AuditRule = {
  id: "tokens-hardcoded-color",
  category: "tokens",
  title: "Hardcoded color instead of a variable",
  description: "A solid fill or stroke uses a raw color value instead of a bound color variable.",
  whyItMatters:
    "Hardcoded colors can't be updated by changing a token, break theming/dark mode, and are the single biggest source of visual drift in a design system.",
  severity: "warning",
  reference: "Design token best practice: bind color to semantic variables",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const nodes = ownNodes(variant);
        for (const node of nodes) {
          if ("fills" in node && !hasStyleApplied(node, "fills")) {
            const fills = (node as MinimalFillsMixin).fills;
            if (Array.isArray(fills)) {
              fills.forEach((paint, i) => {
                if (paint.type === "SOLID" && paint.visible !== false && !hasBoundVariableAt(node, "fills", i)) {
                  findings.push({
                    node: toNodeRef(node, record.info.id, record.info.name),
                    message: `Fill on "${node.name}" in ${record.info.name} is a hardcoded color, not a variable.`,
                    severity: "warning",
                    impact: "medium",
                    effort: "low",
                    key: `fill-${i}`,
                    meta: { property: "fill" }
                  });
                }
              });
            }
          }
          if ("strokes" in node && !hasStyleApplied(node, "strokes")) {
            const strokes = (node as MinimalStrokesMixin).strokes;
            strokes.forEach((paint, i) => {
              if (paint.type === "SOLID" && paint.visible !== false && !hasBoundVariableAt(node, "strokes", i)) {
                findings.push({
                  node: toNodeRef(node, record.info.id, record.info.name),
                  message: `Stroke on "${node.name}" in ${record.info.name} is a hardcoded color, not a variable.`,
                  severity: "warning",
                  impact: "medium",
                  effort: "low",
                  key: `stroke-${i}`,
                  meta: { property: "stroke" }
                });
              }
            });
          }
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation(finding) {
    return `Replace this hardcoded ${finding.meta?.property ?? "color"} with the matching semantic color variable.`;
  }
};

const hardcodedRadiusRule: AuditRule = {
  id: "tokens-hardcoded-radius",
  category: "tokens",
  title: "Hardcoded corner radius",
  description: "Corner radius is a raw number instead of a bound radius variable.",
  whyItMatters: "Unbound radii drift from the shape scale and make global radius changes require manual sweeps.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const nodes = ownNodes(variant);
        for (const node of nodes) {
          if (!("cornerRadius" in node)) continue;
          const radius = (node as unknown as CornerMixin).cornerRadius;
          if (typeof radius === "number" && radius > 0 && !hasBoundVariableAt(node, "cornerRadius")) {
            findings.push({
              node: toNodeRef(node, record.info.id, record.info.name),
              message: `"${node.name}" in ${record.info.name} has a hardcoded ${radius}px corner radius.`,
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
    return "Bind the corner radius to a shared radius variable (e.g. radius/sm, radius/md) instead of a raw number.";
  }
};

const unusedVariableRule: AuditRule = {
  id: "tokens-unused-variable",
  category: "tokens",
  title: "Variable not referenced by any audited component",
  description: "This variable is not bound to any property within the scanned components.",
  whyItMatters:
    "Unused tokens bloat the library, confuse consumers choosing between similar-looking variables, and make it unclear which tokens are actually safe to remove.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const usedIds = new Set<string>();
    const collect = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(collect);
      } else if (value && typeof value === "object") {
        const entry = value as { id?: unknown; boundVariables?: Record<string, unknown> };
        if (typeof entry.id === "string") usedIds.add(entry.id);
        if (entry.boundVariables) Object.values(entry.boundVariables).forEach(collect);
      }
    };
    for (const node of context.allComponentNodes) {
      const bound = (node as { boundVariables?: Record<string, unknown> }).boundVariables;
      if (bound) Object.values(bound).forEach(collect);
      for (const field of ["fills", "strokes", "effects"] as const) {
        const list = (node as unknown as Record<string, unknown>)[field];
        if (Array.isArray(list)) list.forEach(collect);
      }
    }
    // A variable that another variable aliases is referenced, even if no layer binds it directly.
    for (const variable of context.variables) {
      for (const value of Object.values(variable.valuesByMode)) {
        if (value && typeof value === "object" && (value as { type?: string }).type === "VARIABLE_ALIAS") {
          usedIds.add((value as VariableAlias).id);
        }
      }
    }

    const findings: RuleFinding[] = [];
    for (const variable of context.variables) {
      if (!usedIds.has(variable.id)) {
        const collection = context.variableCollections.find((c) => c.id === variable.variableCollectionId)?.name;
        findings.push({
          key: `${collection ?? ""}/${variable.name}`,
          message: `Variable "${variable.name}" is not referenced by any bound property in the audited components (usage outside these components is not visible to this scan).`,
          severity: "suggestion",
          impact: "low",
          effort: "low",
          collection,
          meta: { variableName: variable.name }
        });
      }
    }
    return findings;
  },
  recommendation() {
    return "Confirm this variable is genuinely unused elsewhere in the file/library before removing it, then delete it to reduce token sprawl.";
  }
};

const duplicateVariableRule: AuditRule = {
  id: "tokens-duplicate-variable",
  category: "tokens",
  title: "Duplicate variable value",
  description: "Two variables in the same collection resolve to the identical value across all modes.",
  whyItMatters:
    "Duplicate tokens create ambiguity about which one to use, and teams end up splitting usage between them inconsistently.",
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
      const collectionName = context.variableCollections.find((c) => c.id === collectionId)?.name;
      for (let i = 0; i < vars.length; i++) {
        for (let j = i + 1; j < vars.length; j++) {
          if (vars[i].resolvedType !== vars[j].resolvedType) continue;
          const a = JSON.stringify(vars[i].valuesByMode);
          const b = JSON.stringify(vars[j].valuesByMode);
          if (a === b) {
            findings.push({
              message: `"${vars[i].name}" and "${vars[j].name}" resolve to the same value in every mode.`,
              severity: "suggestion",
              impact: "low",
              effort: "medium",
              collection: collectionName,
              key: `${vars[i].name}|${vars[j].name}`,
              meta: { a: vars[i].name, b: vars[j].name }
            });
          }
        }
      }
    }
    return findings;
  },
  recommendation(finding) {
    return `Consolidate "${finding.meta?.a}" and "${finding.meta?.b}" into a single variable, or make one an alias of the other if they represent distinct semantic roles.`;
  }
};

const hardcodedShadowRule: AuditRule = {
  id: "tokens-hardcoded-shadow",
  category: "tokens",
  title: "Hardcoded shadow effect",
  description: "A drop/inner shadow effect is set directly on the layer instead of a bound effect variable or shared effect style.",
  whyItMatters: "Unbound shadows drift from the elevation system and make global depth/elevation changes require manual sweeps across every component.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const nodes = ownNodes(variant);
        for (const node of nodes) {
          if (!("effects" in node) || hasStyleApplied(node, "effects")) continue;
          const effects = (node as BlendMixin).effects;
          if (!Array.isArray(effects)) continue;
          effects.forEach((effect, i) => {
            const isShadow = effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW";
            if (isShadow && effect.visible !== false && !hasBoundVariableAt(node, "effects", i)) {
              findings.push({
                node: toNodeRef(node, record.info.id, record.info.name),
                message: `"${node.name}" in ${record.info.name} has a hardcoded ${effect.type === "DROP_SHADOW" ? "drop" : "inner"} shadow.`,
                severity: "suggestion",
                impact: "low",
                effort: "low",
                key: `effect-${i}`
              });
            }
          });
        }
      }
      if (context.isCancelled()) break;
    }
    return findings;
  },
  recommendation() {
    return "Apply a shared effect style, or bind the shadow to an elevation variable, instead of a one-off shadow.";
  }
};

const hardcodedOpacityRule: AuditRule = {
  id: "tokens-hardcoded-opacity",
  category: "tokens",
  title: "Hardcoded opacity",
  description: "Layer opacity is a raw, non-default number instead of a bound opacity variable.",
  whyItMatters: "Ad-hoc opacity values (0.64, 0.72, 0.8...) accumulate over time and make it unclear which value represents a deliberate disabled/hover/scrim state.",
  severity: "suggestion",
  evaluate(context: RuleContext): RuleFinding[] {
    const findings: RuleFinding[] = [];
    for (const record of context.components) {
      for (const variant of record.variantNodes) {
        const nodes = ownNodes(variant);
        for (const node of nodes) {
          if (!("opacity" in node)) continue;
          const opacity = (node as BlendMixin).opacity;
          if (opacity !== 1 && !hasBoundVariableAt(node, "opacity")) {
            findings.push({
              node: toNodeRef(node, record.info.id, record.info.name),
              message: `"${node.name}" in ${record.info.name} has a hardcoded opacity of ${Math.round(opacity * 100)}%.`,
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
    return "Bind opacity to a shared variable (e.g. opacity/disabled, opacity/hover) so the meaning of the value is explicit and reusable.";
  }
};

const brokenAliasRule: AuditRule = {
  id: "tokens-broken-alias",
  category: "tokens",
  title: "Variable alias points to a missing variable",
  description: "A variable's value is an alias referencing a variable id that no longer exists in this file.",
  whyItMatters: "Broken alias chains silently fall back to an undefined or stale value, which is one of the hardest token bugs to spot visually.",
  severity: "critical",
  async evaluate(context: RuleContext): Promise<RuleFinding[]> {
    const knownIds = new Set(context.variables.map((v) => v.id));
    // Aliases to variables from an enabled library aren't in the local list, so confirm with
    // Figma before calling them broken. Resolved lookups are cached per id.
    const resolved = new Map<string, boolean>();
    const exists = async (id: string): Promise<boolean> => {
      if (knownIds.has(id)) return true;
      const cached = resolved.get(id);
      if (cached !== undefined) return cached;
      let found = false;
      try {
        found = (await figma.variables.getVariableByIdAsync(id)) !== null;
      } catch {
        found = false;
      }
      resolved.set(id, found);
      return found;
    };
    const findings: RuleFinding[] = [];

    for (const variable of context.variables) {
      const collection = context.variableCollections.find((c) => c.id === variable.variableCollectionId)?.name;
      for (const [modeId, value] of Object.entries(variable.valuesByMode)) {
        if (value && typeof value === "object" && (value as { type?: string }).type === "VARIABLE_ALIAS") {
          const aliasId = (value as VariableAlias).id;
          if (!(await exists(aliasId))) {
            findings.push({
              message: `"${variable.name}" (mode ${modeId}) aliases a variable that no longer exists.`,
              severity: "critical",
              impact: "high",
              effort: "medium",
              collection,
              key: `${collection ?? ""}/${variable.name}/${modeId}`,
              meta: { variableName: variable.name }
            });
          }
        }
      }
    }
    return findings;
  },
  recommendation() {
    return "Repoint this alias to a valid variable, or replace it with a direct value if the original target was intentionally deleted.";
  }
};

export const tokenRules: AuditRule[] = [
  hardcodedColorRule,
  hardcodedRadiusRule,
  hardcodedShadowRule,
  hardcodedOpacityRule,
  unusedVariableRule,
  duplicateVariableRule,
  brokenAliasRule
];
