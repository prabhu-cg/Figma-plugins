import { toPathSegments } from '@shared/naming';
import type {
  DesignSystem,
  StyleToken,
  TokenCategory,
  TokenValue,
  VariableToken,
} from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { buildTokenTree, stripRedundantCategoryPrefix, type TokenTreeEntry } from './tokenTree';

type JsonLeaf = {
  $type: string;
  $value: string | number | boolean | null;
  $description?: string;
  $extensions: {
    figma: {
      source: 'variable' | 'style';
      collection?: string;
      cssName: string;
      scopes?: string[];
      modes?: Record<string, string | number | boolean | null>;
    };
  };
};

function isJsonLeaf(v: unknown): v is JsonLeaf {
  return typeof v === 'object' && v !== null && '$value' in v;
}

function valueToJson(value: TokenValue): string | number | boolean | null {
  switch (value.kind) {
    case 'color':
      return value.color.hex;
    case 'float':
      return value.value;
    case 'string':
      return value.value;
    case 'boolean':
      return value.value;
    case 'alias':
      return `{${toPathSegments(value.variableName).join('.')}}`;
    default:
      return null;
  }
}

function variableToLeaf(
  variable: VariableToken,
  category: TokenCategory,
): TokenTreeEntry<JsonLeaf> {
  const defaultValue = variable.valuesByMode[0];
  const modes: Record<string, string | number | boolean | null> = {};
  for (const vbm of variable.valuesByMode) {
    modes[vbm.modeName] = valueToJson(vbm.value);
  }

  return {
    path: stripRedundantCategoryPrefix(variable.path, category),
    leaf: {
      $type: category,
      $value: defaultValue ? valueToJson(defaultValue.value) : null,
      $description: variable.description || undefined,
      $extensions: {
        figma: {
          source: 'variable',
          collection: variable.collectionName,
          cssName: variable.cssName,
          scopes: variable.scopes,
          modes,
        },
      },
    },
  };
}

function styleToLeaf(style: StyleToken, category: TokenCategory): TokenTreeEntry<JsonLeaf> {
  let value: string | number | boolean | null = null;
  if (style.type === 'PAINT') value = style.paint?.hex ?? null;
  else if (style.type === 'TEXT') value = JSON.stringify(style.textProperties);
  else if (style.type === 'EFFECT') value = JSON.stringify(style.effects);
  else if (style.type === 'GRID') value = JSON.stringify(style.grids);

  return {
    path: stripRedundantCategoryPrefix(style.path, category),
    leaf: {
      $type: category,
      $value: value,
      $description: style.description || undefined,
      $extensions: {
        figma: { source: 'style', cssName: style.cssName },
      },
    },
  };
}

const CATEGORY_STYLE_FALLBACK: Partial<Record<TokenCategory, keyof DesignSystem['styles']>> = {
  color: 'color',
  typography: 'text',
  effect: 'effect',
  grid: 'grid',
};

function buildCategorySection(ds: DesignSystem, category: TokenCategory): Record<string, unknown> {
  const variables = ds.variables.filter((v) => v.category === category);

  let entries: TokenTreeEntry<JsonLeaf>[];
  if (variables.length > 0) {
    entries = variables.map((v) => variableToLeaf(v, category));
  } else {
    const fallbackKey = CATEGORY_STYLE_FALLBACK[category];
    const fallbackStyles = fallbackKey ? ds.styles[fallbackKey] : [];
    entries = fallbackStyles.map((s) => styleToLeaf(s, category));
  }

  return buildTokenTree(entries, isJsonLeaf);
}

const CATEGORIES: TokenCategory[] = [
  'color',
  'typography',
  'spacing',
  'effect',
  'grid',
  'semantic',
  'component',
];

export function generateTokensJson(ds: DesignSystem): GeneratedFile {
  const output: Record<string, unknown> = {
    $schema: 'https://designmd.dev/schema/tokens.json',
    metadata: {
      fileName: ds.metadata.fileName,
      generatedAt: ds.metadata.generatedAt,
      pluginVersion: ds.metadata.pluginVersion,
    },
  };

  for (const category of CATEGORIES) {
    output[category] = buildCategorySection(ds, category);
  }

  // Anything that didn't fit a named bucket (booleans, strings, numbers, "other").
  const otherVariables = ds.variables.filter((v) => !CATEGORIES.includes(v.category));
  if (otherVariables.length > 0) {
    output.other = buildTokenTree(
      otherVariables.map((v) => variableToLeaf(v, v.category)),
      isJsonLeaf,
    );
  }

  return {
    path: 'tokens.json',
    content: JSON.stringify(output, null, 2),
  };
}
