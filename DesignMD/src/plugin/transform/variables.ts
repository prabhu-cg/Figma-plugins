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
      valuesByMode: v.valuesByMode.map((vbm) => ({
        modeId: vbm.modeId,
        modeName: modeNames.get(vbm.modeId) ?? vbm.modeId,
        value: toTokenValue(vbm.value, variableNamesById),
      })),
      codeSyntax: v.codeSyntax,
      cssName: toCssVarName(path),
    };
  });
}
