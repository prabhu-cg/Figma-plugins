import type { DesignSystem, ExtractionScope } from '@shared/types';
import type { ExtractionResult } from '../extraction/rawTypes';
import { transformComponents } from './components';
import {
  transformEffectStyles,
  transformGridStyles,
  transformPaintStyles,
  transformTextStyles,
} from './styles';
import {
  inlineHiddenAliases,
  isCollectionHidden,
  isVariableHidden,
  transformVariableCollections,
  transformVariables,
} from './variables';
import { computeStyleUsage, computeVariableUsage, mergeStyleBoundVariables } from './usage';
import { buildSummary } from './summary';

const PLUGIN_VERSION = '1.0.0';

export function transformToDesignSystem(
  raw: ExtractionResult,
  fileName: string,
  scope: ExtractionScope = 'file',
): DesignSystem {
  const allCollections = transformVariableCollections(raw.collections);
  const collectionsById = new Map(raw.collections.map((c) => [c.id, c]));
  const hiddenVariableIds = new Set(
    raw.variables
      .filter((v) => isVariableHidden(v, collectionsById.get(v.variableCollectionId)))
      .map((v) => v.id),
  );
  const warnings = [...raw.warnings];
  if (hiddenVariableIds.size > 0) {
    warnings.push(
      `Skipped ${hiddenVariableIds.size} variable(s) hidden from publishing (hidden flag, or a name/group/collection starting with ".").`,
    );
  }
  const collections = allCollections
    .filter((c) => !isCollectionHidden(c))
    .map((c) => ({ ...c, variableIds: c.variableIds.filter((id) => !hiddenVariableIds.has(id)) }));

  const rawStyles = {
    text: transformTextStyles(raw.textStyles),
    color: transformPaintStyles(raw.paintStyles),
    effect: transformEffectStyles(raw.effectStyles),
    grid: transformGridStyles(raw.gridStyles),
  };

  const rawComponents = mergeStyleBoundVariables(raw.components, [
    ...raw.textStyles,
    ...raw.paintStyles,
    ...raw.effectStyles,
  ]).map((c) => ({
    ...c,
    boundVariableIds: c.boundVariableIds.filter((id) => !hiddenVariableIds.has(id)),
  }));
  const components = transformComponents(rawComponents);
  const variables = computeVariableUsage(
    inlineHiddenAliases(
      transformVariables(raw.variables, allCollections),
      hiddenVariableIds,
    ).filter((v) => !hiddenVariableIds.has(v.id)),
    components,
  );

  const styles = computeStyleUsage(rawStyles, components);
  const base = { collections, variables, styles, components };

  return {
    metadata: {
      fileName,
      scope,
      generatedAt: new Date().toISOString(),
      pluginVersion: PLUGIN_VERSION,
    },
    ...base,
    summary: buildSummary(base),
    warnings,
  };
}
