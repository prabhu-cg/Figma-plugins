import type { DesignSystem } from '@shared/types';
import type { ExtractionResult } from '../extraction/rawTypes';
import { transformComponents } from './components';
import {
  transformEffectStyles,
  transformGridStyles,
  transformPaintStyles,
  transformTextStyles,
} from './styles';
import { transformVariableCollections, transformVariables } from './variables';
import { computeVariableUsage } from './usage';
import { buildSummary } from './summary';

const PLUGIN_VERSION = '1.0.0';

export function transformToDesignSystem(raw: ExtractionResult, fileName: string): DesignSystem {
  const collections = transformVariableCollections(raw.collections);

  const styles = {
    text: transformTextStyles(raw.textStyles),
    color: transformPaintStyles(raw.paintStyles),
    effect: transformEffectStyles(raw.effectStyles),
    grid: transformGridStyles(raw.gridStyles),
  };

  const components = transformComponents(raw.components);
  const variables = computeVariableUsage(
    transformVariables(raw.variables, collections),
    components,
  );

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
