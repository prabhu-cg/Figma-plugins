import type { DesignSystem, DesignSystemSummary } from '@shared/types';

export function buildSummary(
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
    textStylesCount: system.styles.text.filter((s) => !s.library).length,
    colorStylesCount: system.styles.color.filter((s) => !s.library).length,
    effectStylesCount: system.styles.effect.filter((s) => !s.library).length,
    gridStylesCount: system.styles.grid.filter((s) => !s.library).length,
    modesCount: modeIds.size,
  };
}
