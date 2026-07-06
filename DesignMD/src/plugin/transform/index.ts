import type { DesignSystem, DesignSystemSummary } from '@shared/types';
import type { ExtractionResult } from '../extraction/rawTypes';
import { transformComponents } from './components';
import {
  transformEffectStyles,
  transformGridStyles,
  transformPaintStyles,
  transformTextStyles,
} from './styles';
import { transformVariableCollections, transformVariables } from './variables';

const PLUGIN_VERSION = '1.0.0';

function buildSummary(
  system: Omit<DesignSystem, 'summary' | 'warnings' | 'metadata'>,
): DesignSystemSummary {
  const modeIds = new Set(system.collections.flatMap((c) => c.modes.map((m) => m.modeId)));
  return {
    variableCollectionsCount: system.collections.length,
    variablesCount: system.variables.length,
    componentsCount: system.components.reduce(
      (sum, c) => sum + (c.isComponentSet ? c.variants.length : 1),
      0,
    ),
    componentSetsCount: system.components.filter((c) => c.isComponentSet).length,
    textStylesCount: system.styles.text.length,
    colorStylesCount: system.styles.color.length,
    effectStylesCount: system.styles.effect.length,
    gridStylesCount: system.styles.grid.length,
    modesCount: modeIds.size,
  };
}

export function transformToDesignSystem(raw: ExtractionResult, fileName: string): DesignSystem {
  const collections = transformVariableCollections(raw.collections);
  const variables = transformVariables(raw.variables, collections);

  const styles = {
    text: transformTextStyles(raw.textStyles),
    color: transformPaintStyles(raw.paintStyles),
    effect: transformEffectStyles(raw.effectStyles),
    grid: transformGridStyles(raw.gridStyles),
  };

  const components = transformComponents(raw.components);

  const base = { collections, variables, styles, components };

  return {
    metadata: {
      fileName,
      generatedAt: new Date().toISOString(),
      pluginVersion: PLUGIN_VERSION,
    },
    ...base,
    summary: buildSummary(base),
    warnings: raw.warnings,
  };
}
