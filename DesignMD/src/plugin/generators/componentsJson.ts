/**
 * components.json (designmd.components/v1): components with their layer trees, variant diffs and
 * the tokens they use. Deterministic: fixed key order, stable array order, "\n" line endings, and
 * a content hash so tools can detect changes. See docs/components-json.md.
 */
import {
  COMPONENTS_SCHEMA_ID,
  COMPONENTS_SCHEMA_URL,
  type ColorRgba,
  type ComponentPropertyV1,
  type ComponentV1,
  type ComponentsFileV1,
  type ComponentsWarning,
  type Layer,
  type TokenEntry,
} from '@shared/componentsSchema';
import type { GeneratedFile } from '@shared/messages';
import { sha256 } from '@shared/sha256';
import type {
  ColorValue,
  ComponentDoc,
  DesignSystem,
  StyleToken,
  VariableToken,
} from '@shared/types';
import { cleanPropertyName, isStructure, type StructureResult } from '../extraction/structures';
import { defaultModeValue } from './tokenValue';

const OUTPUT_PATH = 'components.json';
const MAX_ALIAS_DEPTH = 20;

const colorOf = (c: ColorValue): ColorRgba => ({
  hex: c.hex.slice(0, 7).toLowerCase(),
  alpha: Math.round(c.a * 1000) / 1000,
  r: c.r,
  g: c.g,
  b: c.b,
});

/** The default-mode value of a variable, following aliases to a primitive. */
function resolveVariable(
  variable: VariableToken,
  byId: ReadonlyMap<string, VariableToken>,
): TokenEntry | undefined {
  let current: VariableToken | undefined = variable;
  for (let depth = 0; current && depth < MAX_ALIAS_DEPTH; depth++) {
    const value = defaultModeValue(current);
    if (!value) return undefined;
    switch (value.kind) {
      case 'color':
        return { cssName: variable.cssName, type: 'color', value: colorOf(value.color) };
      case 'float':
        return {
          cssName: variable.cssName,
          type: variable.category === 'spacing' ? 'dimension' : 'number',
          value: value.value,
        };
      case 'string':
        return {
          cssName: variable.cssName,
          type: /font.?family/i.test(variable.name) ? 'fontFamily' : 'string',
          value: value.value,
        };
      case 'boolean':
        return { cssName: variable.cssName, type: 'boolean', value: value.value };
      case 'alias':
        current = byId.get(value.variableId);
        break;
      default:
        return undefined;
    }
  }
  return undefined;
}

function styleEntry(style: StyleToken): TokenEntry | undefined {
  if (style.type === 'PAINT') {
    if (style.paint) return { cssName: style.cssName, type: 'color', value: colorOf(style.paint) };
    if (style.paintIsGradientOrImage) {
      return {
        cssName: style.cssName,
        type: 'gradient',
        value: { description: 'gradient or image paint' },
      };
    }
    return undefined;
  }
  if (style.type === 'TEXT' && style.textProperties) {
    const p = style.textProperties;
    return {
      cssName: style.cssName,
      type: 'typography',
      value: {
        fontFamily: p.fontFamily,
        fontStyle: p.fontStyle,
        fontWeight: p.fontWeight,
        fontSize: p.fontSize,
        lineHeight: p.lineHeight,
        letterSpacing: p.letterSpacing,
        textCase: p.textCase,
        textDecoration: p.textDecoration,
      },
    };
  }
  if (style.type === 'EFFECT' && style.effects?.length) {
    const e = style.effects[0];
    const value: Record<string, string | number | boolean> = {
      effectType: e.type,
      effectCount: style.effects.length,
    };
    if (e.color) value.color = colorOf(e.color).hex;
    if (e.offsetX !== undefined) value.offsetX = e.offsetX;
    if (e.offsetY !== undefined) value.offsetY = e.offsetY;
    if (e.radius !== undefined) value.radius = e.radius;
    if (e.spread !== undefined) value.spread = e.spread;
    return { cssName: style.cssName, type: 'shadow', value };
  }
  if (style.type === 'GRID' && style.grids?.length) {
    const g = style.grids[0];
    const value: Record<string, string | number | boolean> = { pattern: g.pattern };
    if (g.count !== undefined) value.count = g.count;
    if (g.sectionSize !== undefined) value.sectionSize = g.sectionSize;
    if (g.gutterSize !== undefined) value.gutterSize = g.gutterSize;
    return { cssName: style.cssName, type: 'grid', value };
  }
  return undefined;
}

const stubTree = (doc: ComponentDoc): Layer => ({
  id: doc.id,
  name: doc.name,
  type: doc.isComponentSet ? 'COMPONENT_SET' : 'COMPONENT',
  visible: true,
  children: [],
});

/** Properties from the plain ComponentDoc, for components whose structure could not be read. */
const fallbackProperties = (doc: ComponentDoc): ComponentPropertyV1[] =>
  doc.properties.map((p) => ({
    key: p.name,
    name: cleanPropertyName(p.name),
    type: p.type,
    defaultValue: p.defaultValue,
    ...(p.variantOptions ? { variantOptions: p.variantOptions } : {}),
  }));

const byPageThenName = (a: ComponentDoc, b: ComponentDoc) =>
  a.pageName.localeCompare(b.pageName) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);

/** Builds the file object, with `contentHash` empty. Exported for tests. */
export function buildComponentsFile(
  ds: DesignSystem,
  structures: ReadonlyMap<string, StructureResult>,
): ComponentsFileV1 {
  const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
  const stylesById = new Map(
    [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid].map((s) => [
      s.id,
      s,
    ]),
  );
  const warnings: ComponentsWarning[] = [];
  const used = new Set<string>();
  const tokens: Record<string, TokenEntry> = {};

  const addToken = (id: string, componentId: string): boolean => {
    if (id in tokens) return true;
    const variable = variablesById.get(id);
    const style = stylesById.get(id);
    const entry = variable ? resolveVariable(variable, variablesById) : style && styleEntry(style);
    if (!entry) {
      if (!used.has(`warn:${id}`)) {
        used.add(`warn:${id}`);
        warnings.push({
          code: 'UNRESOLVED_REFERENCE',
          message: `The token ${id} is used by a component but is not available in this file's tokens (hidden from publishing, or has no representable value).`,
          componentId,
        });
      }
      return false;
    }
    tokens[id] = entry;
    return true;
  };

  const docs = [...ds.components].sort(byPageThenName);
  const components: ComponentV1[] = docs.map((doc) => {
    const result = structures.get(doc.id);
    const structure = isStructure(result) ? result : undefined;
    if (!structure) {
      warnings.push({
        code: 'COMPONENT_FAILED',
        message: `"${doc.name}" (${doc.id}) could not be read: ${
          result && 'error' in result ? result.error : 'its structure was not extracted'
        }. Its layer tree is empty.`,
        componentId: doc.id,
      });
    } else {
      warnings.push(...structure.warnings);
    }

    const variableIds = new Set([...doc.boundVariableIds, ...(structure?.usedVariableIds ?? [])]);
    const styleIds = new Set([...(doc.styleIds ?? []), ...(structure?.usedStyleIds ?? [])]);
    const boundVariableIds = [...variableIds].sort().filter((id) => addToken(id, doc.id));
    const resolvedStyleIds = [...styleIds].sort().filter((id) => addToken(id, doc.id));

    const component: ComponentV1 = {
      id: doc.id,
      key: doc.key,
      name: doc.name,
      description: doc.description,
      isComponentSet: doc.isComponentSet,
      pageName: doc.pageName,
      variants: doc.variants.map((v) => ({
        id: v.id,
        name: v.name,
        variantProperties: v.variantProperties,
        description: v.description,
      })),
      properties: structure?.properties ?? fallbackProperties(doc),
      states: doc.states,
      sizes: doc.sizes,
      relatedComponentNames: doc.relatedComponentNames,
      boundVariableIds,
      styleIds: resolvedStyleIds,
      ...(doc.layout ? { layout: doc.layout } : {}),
      defaultVariantId: structure?.defaultVariantId ?? doc.variants[0]?.id ?? doc.id,
      tree: structure?.tree ?? stubTree(doc),
      variantDiffs: structure?.variantDiffs ?? [],
      treeTruncated: structure ? structure.treeTruncated : true,
    };
    return component;
  });

  // Sort tokens by id so the object's key order is stable.
  const sortedTokens = Object.fromEntries(
    Object.entries(tokens).sort(([a], [b]) => a.localeCompare(b)),
  );

  return {
    $schema: COMPONENTS_SCHEMA_URL,
    schema: COMPONENTS_SCHEMA_ID,
    metadata: {
      fileName: ds.metadata.fileName,
      scope: ds.metadata.scope,
      generatedAt: ds.metadata.generatedAt,
      pluginVersion: ds.metadata.pluginVersion,
      contentHash: '',
    },
    index: {
      componentCount: components.length,
      components: components.map((c) => ({ id: c.id, name: c.name })),
    },
    tokens: sortedTokens,
    components,
    warnings,
  };
}

/** Serializes with the hash filled in: SHA-256 of the text with generatedAt and contentHash blanked. */
export function serializeComponentsFile(file: ComponentsFileV1): string {
  const blank = JSON.stringify(
    { ...file, metadata: { ...file.metadata, generatedAt: '', contentHash: '' } },
    null,
    2,
  );
  const contentHash = sha256(blank + '\n');
  return JSON.stringify({ ...file, metadata: { ...file.metadata, contentHash } }, null, 2) + '\n';
}

export function generateComponentsJson(
  ds: DesignSystem,
  structures: ReadonlyMap<string, StructureResult>,
): GeneratedFile {
  return {
    path: OUTPUT_PATH,
    content: serializeComponentsFile(buildComponentsFile(ds, structures)),
  };
}
