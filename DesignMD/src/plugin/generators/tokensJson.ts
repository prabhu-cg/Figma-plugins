import { toPathSegments } from '@shared/naming';
import type {
  DesignSystem,
  EffectValue,
  StyleToken,
  TokenCategory,
  TokenValue,
  VariableToken,
} from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { defaultModeValue, primitiveValue } from './tokenValue';
import { buildTokenTree, stripRedundantCategoryPrefix, type TokenTreeEntry } from './tokenTree';

const CATEGORIES: TokenCategory[] = [
  'color',
  'typography',
  'spacing',
  'effect',
  'grid',
  'semantic',
  'component',
];

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type JsonLeaf = {
  $type: string;
  $value: JsonValue;
  $description?: string;
  $extensions: {
    figma: {
      source: 'variable' | 'style';
      collection?: string;
      cssName: string;
      scopes?: string[];
      modes?: Record<string, JsonValue>;
      usedBy?: string[];
      [key: string]: JsonValue | undefined;
    };
  };
};

function isJsonLeaf(v: unknown): v is JsonLeaf {
  return typeof v === 'object' && v !== null && '$value' in v;
}

/** Path segments may not contain "." or "{}" (they delimit references) or start with "$" (reserved). */
function safeSegment(segment: string): string {
  return segment.replace(/[.{}]/g, '-').replace(/^\$/, '_');
}

function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

const DIMENSION_SCOPES = [
  'CORNER_RADIUS',
  'WIDTH_HEIGHT',
  'GAP',
  'FONT_SIZE',
  'LETTER_SPACING',
  'LINE_HEIGHT',
  'PARAGRAPH_SPACING',
  'PARAGRAPH_INDENT',
];

/** W3C DTCG type for a variable, derived from its Figma type and scopes (not its bucket name). */
function dtcgTypeForVariable(variable: VariableToken): string {
  switch (variable.resolvedType) {
    case 'COLOR':
      return 'color';
    case 'FLOAT':
      if (variable.scopes.includes('FONT_WEIGHT')) return 'fontWeight';
      if (variable.category === 'spacing') return 'dimension';
      if (variable.scopes.some((s) => DIMENSION_SCOPES.includes(s))) return 'dimension';
      return 'number';
    case 'STRING':
      return variable.scopes.includes('FONT_FAMILY') ? 'fontFamily' : 'string';
    case 'BOOLEAN':
      return 'boolean';
    default:
      return 'string';
  }
}

interface ValueContext {
  /** Dotted token path (as emitted in the tree) for every variable, so aliases point at real tokens. */
  pathsById: Map<string, string[]>;
}

function valueToJson(value: TokenValue, type: string, ctx: ValueContext): JsonValue {
  switch (value.kind) {
    case 'float':
      return type === 'dimension' ? `${value.value}px` : value.value;
    case 'alias': {
      const path =
        ctx.pathsById.get(value.variableId) ?? toPathSegments(value.variableName).map(safeSegment);
      return `{${path.join('.')}}`;
    }
    default:
      return primitiveValue(value);
  }
}

function variableSection(category: TokenCategory): string {
  return CATEGORIES.includes(category) ? category : 'other';
}

function variableTreePath(variable: VariableToken): string[] {
  return stripRedundantCategoryPrefix(variable.path, variable.category).map(safeSegment);
}

function variableToLeaf(variable: VariableToken, ctx: ValueContext): TokenTreeEntry<JsonLeaf> {
  const type = dtcgTypeForVariable(variable);
  const defaultValue = defaultModeValue(variable);
  const modes: Record<string, JsonValue> = {};
  for (const vbm of variable.valuesByMode) {
    modes[vbm.modeName] = valueToJson(vbm.value, type, ctx);
  }

  return {
    path: variableTreePath(variable),
    leaf: {
      $type: type,
      $value: defaultValue ? valueToJson(defaultValue, type, ctx) : null,
      $description: variable.description || undefined,
      $extensions: {
        figma: {
          source: 'variable',
          collection: variable.collectionName,
          cssName: variable.cssName,
          scopes: variable.scopes,
          modes,
          usedBy: variable.usedByComponents,
        },
      },
    },
  };
}

function lineHeightToMultiplier(lineHeight: string, fontSize: number): number | undefined {
  if (lineHeight.endsWith('%')) return round(parseFloat(lineHeight) / 100);
  if (lineHeight.endsWith('px') && fontSize > 0) return round(parseFloat(lineHeight) / fontSize);
  return undefined; // AUTO has no numeric equivalent
}

function letterSpacingToPx(letterSpacing: string, fontSize: number): string {
  if (letterSpacing.endsWith('%'))
    return `${round((parseFloat(letterSpacing) / 100) * fontSize, 2)}px`;
  return letterSpacing;
}

function shadowToJson(e: EffectValue): JsonValue {
  const shadow: { [key: string]: JsonValue } = {
    color: e.color?.hex ?? '#000000',
    offsetX: `${e.offsetX ?? 0}px`,
    offsetY: `${e.offsetY ?? 0}px`,
    blur: `${e.radius ?? 0}px`,
    spread: `${e.spread ?? 0}px`,
  };
  if (e.type === 'INNER_SHADOW') shadow.inset = true;
  return shadow;
}

/** Returns null for styles with no DTCG-representable value (gradients, empty effects), so they're omitted. */
function styleToLeaf(style: StyleToken, category: TokenCategory): TokenTreeEntry<JsonLeaf> | null {
  const figma: JsonLeaf['$extensions']['figma'] = {
    source: 'style',
    cssName: style.cssName,
    usedBy: style.usedByComponents ?? [],
  };
  let type: string;
  let value: JsonValue;

  if (style.type === 'PAINT') {
    if (!style.paint) return null;
    type = 'color';
    value = style.paint.hex;
  } else if (style.type === 'TEXT') {
    const p = style.textProperties;
    if (!p) return null;
    type = 'typography';
    const typography: { [key: string]: JsonValue } = {
      fontFamily: p.fontFamily,
      fontSize: `${p.fontSize}px`,
      fontWeight: p.fontWeight,
      letterSpacing: letterSpacingToPx(p.letterSpacing, p.fontSize),
    };
    const lineHeight = lineHeightToMultiplier(p.lineHeight, p.fontSize);
    if (lineHeight !== undefined) typography.lineHeight = lineHeight;
    value = typography;
    figma.fontStyle = p.fontStyle;
    figma.textCase = p.textCase;
    figma.textDecoration = p.textDecoration;
    figma.paragraphSpacing = p.paragraphSpacing;
  } else if (style.type === 'EFFECT') {
    const visible = (style.effects ?? []).filter((e) => e.visible);
    const shadows = visible.filter((e) => e.type === 'DROP_SHADOW' || e.type === 'INNER_SHADOW');
    const blur = visible.find((e) => e.type === 'LAYER_BLUR' || e.type === 'BACKGROUND_BLUR');
    if (shadows.length > 0) {
      type = 'shadow';
      value = shadows.length === 1 ? shadowToJson(shadows[0]) : shadows.map(shadowToJson);
    } else if (blur?.radius !== undefined) {
      type = 'dimension';
      value = `${blur.radius}px`;
      figma.effectType = blur.type;
    } else {
      return null;
    }
  } else {
    // Figma layout grids have no DTCG equivalent; kept as a vendor-specific composite.
    type = 'grid';
    value = (style.grids ?? []).map((g) => {
      const grid: { [key: string]: JsonValue } = { pattern: g.pattern };
      if (g.count !== undefined) grid.count = g.count;
      if (g.gutterSize !== undefined) grid.gutter = `${g.gutterSize}px`;
      if (g.offset !== undefined) grid.offset = `${g.offset}px`;
      if (g.sectionSize !== undefined) grid.sectionSize = `${g.sectionSize}px`;
      if (g.alignment !== undefined) grid.alignment = g.alignment;
      return grid;
    });
  }

  return {
    path: stripRedundantCategoryPrefix(style.path, category).map(safeSegment),
    leaf: {
      $type: type,
      $value: value,
      $description: style.description || undefined,
      $extensions: { figma },
    },
  };
}

const CATEGORY_STYLE_FALLBACK: Partial<Record<TokenCategory, keyof DesignSystem['styles']>> = {
  color: 'color',
  typography: 'text',
  effect: 'effect',
  grid: 'grid',
};

function buildCategorySection(
  ds: DesignSystem,
  category: TokenCategory,
  ctx: ValueContext,
): Record<string, unknown> {
  const variables = ds.variables.filter((v) => v.category === category);

  let entries: TokenTreeEntry<JsonLeaf>[];
  if (variables.length > 0) {
    entries = variables.map((v) => variableToLeaf(v, ctx));
  } else {
    const fallbackKey = CATEGORY_STYLE_FALLBACK[category];
    const fallbackStyles = fallbackKey ? ds.styles[fallbackKey] : [];
    entries = fallbackStyles
      .map((s) => styleToLeaf(s, category))
      .filter((e): e is TokenTreeEntry<JsonLeaf> => e !== null);
  }

  return buildTokenTree(entries, isJsonLeaf);
}

export function generateTokensJson(ds: DesignSystem): GeneratedFile {
  const output: Record<string, unknown> = {
    metadata: {
      fileName: ds.metadata.fileName,
      generatedAt: ds.metadata.generatedAt,
      pluginVersion: ds.metadata.pluginVersion,
    },
  };

  const ctx: ValueContext = {
    pathsById: new Map(
      ds.variables.map((v) => [v.id, [variableSection(v.category), ...variableTreePath(v)]]),
    ),
  };

  for (const category of CATEGORIES) {
    output[category] = buildCategorySection(ds, category, ctx);
  }

  // Anything that didn't fit a named bucket (booleans, strings, numbers, "other").
  const otherVariables = ds.variables.filter((v) => !CATEGORIES.includes(v.category));
  if (otherVariables.length > 0) {
    output.other = buildTokenTree(
      otherVariables.map((v) => variableToLeaf(v, ctx)),
      isJsonLeaf,
    );
  }

  return {
    path: 'tokens.json',
    content: JSON.stringify(output, null, 2),
  };
}
