import type { TokenBindings, HealthWarning } from '@/types/schemas';

interface NodeLike {
  id: string;
  name: string;
  fillStyleId?: string;
  strokeStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
  fills?: Array<{ type?: string }>;
  boundVariables?: Record<string, unknown>;
  children?: NodeLike[];
}

export interface TokenBindingResult {
  bindings: TokenBindings;
  hardcodedWarnings: HealthWarning[];
}

function collectBindings(
  node: NodeLike,
  colors: Set<string>,
  typography: Set<string>,
  spacing: Set<string>,
  effects: Set<string>,
  warnings: HealthWarning[]
): void {
  if (node.fillStyleId) {
    colors.add(node.fillStyleId);
  } else if (node.fills && node.fills.length > 0) {
    const solidFills = node.fills.filter(f => f.type === 'SOLID');
    if (solidFills.length > 0) {
      warnings.push({
        severity: 'warning',
        domain: 'components',
        itemId: node.id,
        itemName: node.name,
        code: 'HARDCODED_VALUE',
        message: `Layer "${node.name}" uses a hardcoded fill color`,
        suggestion: 'Link this fill to a color style or variable',
      });
    }
  }

  if (node.strokeStyleId) colors.add(node.strokeStyleId);
  if (node.textStyleId) typography.add(node.textStyleId);
  if (node.effectStyleId) effects.add(node.effectStyleId);

  if (node.boundVariables) {
    for (const [key, rawAlias] of Object.entries(node.boundVariables)) {
      const aliases = Array.isArray(rawAlias) ? rawAlias : [rawAlias];
      for (const a of aliases) {
        const id = (a as any)?.id as string | undefined;
        if (!id) continue;
        if (key === 'fills' || key === 'strokes') {
          colors.add(id);
        } else if (key === 'itemSpacing' || key.includes('padding') || key.includes('gap')) {
          spacing.add(id);
        }
      }
    }
  }

  for (const child of node.children ?? []) {
    collectBindings(child, colors, typography, spacing, effects, warnings);
  }
}

export function detectTokenBindings(node: NodeLike): TokenBindingResult {
  const colors = new Set<string>();
  const typography = new Set<string>();
  const spacing = new Set<string>();
  const effects = new Set<string>();
  const warnings: HealthWarning[] = [];

  collectBindings(node, colors, typography, spacing, effects, warnings);

  return {
    bindings: {
      colors: Array.from(colors),
      typography: Array.from(typography),
      spacing: Array.from(spacing),
      effects: Array.from(effects),
    },
    hardcodedWarnings: warnings,
  };
}
