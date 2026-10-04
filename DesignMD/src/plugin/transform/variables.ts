import { rgbaToHex, toCssVarName, toPathSegments } from '@shared/naming';
import type { TokenValue, VariableCollection, VariableToken } from '@shared/types';
import type { RawVariable, RawVariableCollection, RawVariableValue } from '../extraction/rawTypes';
import { classifyVariable } from './classify';

function toTokenValue(raw: RawVariableValue, variableNamesById: Map<string, string>): TokenValue {
  switch (raw.kind) {
    case 'color':
      return { kind: 'color', color: { ...raw, hex: rgbaToHex(raw.r, raw.g, raw.b, raw.a) } };
    case 'float':
      return { kind: 'float', value: raw.value };
    case 'string':
      return { kind: 'string', value: raw.value };
    case 'boolean':
      return { kind: 'boolean', value: raw.value };
    case 'alias':
      return {
        kind: 'alias',
        variableId: raw.variableId,
        variableName: variableNamesById.get(raw.variableId) ?? raw.variableId,
      };
    default:
      return { kind: 'unknown' };
  }
}

function orderDefaultModeFirst<T extends { modeId: string }>(
  values: T[],
  defaultModeId: string | undefined,
): T[] {
  const index = values.findIndex((v) => v.modeId === defaultModeId);
  if (index <= 0) return values;
  return [values[index], ...values.slice(0, index), ...values.slice(index + 1)];
}

/** Figma's "hide from publishing" convention: the flag, or a name starting with ".". */
export function isCollectionHidden(c: { name: string; hiddenFromPublishing: boolean }): boolean {
  return c.hiddenFromPublishing || c.name.trim().startsWith('.');
}

/** A variable is hidden when it, a group in its name, or its whole collection is hidden from publishing. */
export function isVariableHidden(
  v: Pick<RawVariable, 'name' | 'hiddenFromPublishing'>,
  collection: { name: string; hiddenFromPublishing: boolean } | undefined,
): boolean {
  if (v.hiddenFromPublishing) return true;
  if (collection && isCollectionHidden(collection)) return true;
  return toPathSegments(v.name).some((segment) => segment.startsWith('.'));
}

/**
 * Hidden variables are dropped from outputs, so an alias pointing at one would reference a
 * token that doesn't exist. Replace such aliases with the hidden target's own value.
 */
export function inlineHiddenAliases(
  variables: VariableToken[],
  hiddenIds: ReadonlySet<string>,
): VariableToken[] {
  if (hiddenIds.size === 0) return variables;
  const byId = new Map(variables.map((v) => [v.id, v]));

  const resolve = (value: TokenValue, modeId: string, depth = 0): TokenValue => {
    if (value.kind !== 'alias' || !hiddenIds.has(value.variableId) || depth > 10) return value;
    const target = byId.get(value.variableId);
    if (!target) return value;
    const next = target.valuesByMode.find((m) => m.modeId === modeId) ?? target.valuesByMode[0];
    return next ? resolve(next.value, modeId, depth + 1) : { kind: 'unknown' };
  };

  return variables.map((v) => ({
    ...v,
    valuesByMode: v.valuesByMode.map((m) => ({ ...m, value: resolve(m.value, m.modeId) })),
  }));
}

export function transformVariableCollections(raw: RawVariableCollection[]): VariableCollection[] {
  return raw.map((c) => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    defaultModeId: c.defaultModeId,
    variableIds: c.variableIds,
    hiddenFromPublishing: c.hiddenFromPublishing,
  }));
}

export function transformVariables(
  rawVariables: RawVariable[],
  collections: VariableCollection[],
): VariableToken[] {
  const collectionsById = new Map(collections.map((c) => [c.id, c]));
  const modeNamesByCollection = new Map(
    collections.map((c) => [c.id, new Map(c.modes.map((m) => [m.modeId, m.name]))]),
  );
  const variableNamesById = new Map(rawVariables.map((v) => [v.id, v.name]));

  return rawVariables.map((v): VariableToken => {
    const collection = collectionsById.get(v.variableCollectionId);
    const path = toPathSegments(v.name);
    const modeNames = modeNamesByCollection.get(v.variableCollectionId) ?? new Map();
    const resolvedType = v.resolvedType as VariableToken['resolvedType'];

    return {
      id: v.id,
      name: v.name,
      path,
      collectionId: v.variableCollectionId,
      collectionName: collection?.name ?? 'Unknown Collection',
      resolvedType,
      category: classifyVariable(v.name, resolvedType, v.scopes),
      description: v.description,
      scopes: v.scopes,
      // Default mode first: generators treat valuesByMode[0] as the default value.
      valuesByMode: orderDefaultModeFirst(v.valuesByMode, collection?.defaultModeId).map((vbm) => ({
        modeId: vbm.modeId,
        modeName: modeNames.get(vbm.modeId) ?? vbm.modeId,
        value: toTokenValue(vbm.value, variableNamesById),
      })),
      codeSyntax: v.codeSyntax,
      cssName: toCssVarName(path),
      usedByComponents: [],
    };
  });
}
