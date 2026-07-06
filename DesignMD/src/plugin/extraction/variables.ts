import { processInBatches, safely } from '../utils/async';
import type { RawVariable, RawVariableCollection, RawVariableValue } from './rawTypes';

const VARIABLE_BATCH_SIZE = 200;

function toRawValue(value: VariableValue): RawVariableValue {
  if (value === null || value === undefined) return { kind: 'unknown' };
  if (typeof value === 'boolean') return { kind: 'boolean', value };
  if (typeof value === 'number') return { kind: 'float', value };
  if (typeof value === 'string') return { kind: 'string', value };
  if (typeof value === 'object') {
    if ('type' in value && value.type === 'VARIABLE_ALIAS') {
      return { kind: 'alias', variableId: value.id };
    }
    if ('r' in value && 'g' in value && 'b' in value) {
      const rgba = value as RGBA;
      return {
        kind: 'color',
        r: rgba.r,
        g: rgba.g,
        b: rgba.b,
        a: 'a' in rgba ? rgba.a : 1,
      };
    }
  }
  return { kind: 'unknown' };
}

export async function extractVariableCollections(
  onProgress?: (done: number, total: number) => void,
  onWarning?: (message: string) => void,
): Promise<{ collections: RawVariableCollection[]; variables: RawVariable[] }> {
  const warn = onWarning ?? (() => {});

  const figmaCollections = await safely(
    () => figma.variables.getLocalVariableCollectionsAsync(),
    (err) => warn(`Failed to load variable collections: ${String(err)}`),
  );

  const collections: RawVariableCollection[] = (figmaCollections ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    modes: c.modes.map((m) => ({ modeId: m.modeId, name: m.name })),
    defaultModeId: c.defaultModeId,
    variableIds: c.variableIds,
    hiddenFromPublishing: Boolean(c.hiddenFromPublishing),
  }));

  const collectionById = new Map(collections.map((c) => [c.id, c]));
  const allVariableIds = Array.from(new Set(collections.flatMap((c) => c.variableIds)));

  const variables = (
    await processInBatches(
      allVariableIds,
      VARIABLE_BATCH_SIZE,
      async (id) => {
        const v = await safely(
          () => figma.variables.getVariableByIdAsync(id),
          (err) => warn(`Failed to load variable ${id}: ${String(err)}`),
        );
        if (!v) return null;

        const collection = collectionById.get(v.variableCollectionId);
        const valuesByMode = Object.entries(v.valuesByMode).map(([modeId, value]) => ({
          modeId,
          value: toRawValue(value),
        }));

        const raw: RawVariable = {
          id: v.id,
          name: v.name,
          variableCollectionId: v.variableCollectionId,
          resolvedType: v.resolvedType,
          description: v.description ?? '',
          scopes: v.scopes ?? [],
          codeSyntax: (v.codeSyntax ?? {}) as RawVariable['codeSyntax'],
          valuesByMode,
        };

        if (!collection) {
          warn(`Variable "${v.name}" references missing collection ${v.variableCollectionId}`);
        }

        return raw;
      },
      onProgress,
    )
  ).filter((v): v is RawVariable => v !== null);

  return { collections, variables };
}
