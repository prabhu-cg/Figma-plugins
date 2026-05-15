import type { FoundationsSchema, ComponentsSchema } from '@/types/schemas';
import type { ComponentDoc } from '@/types/schemas';

export interface SelectionFilter {
  selectedNodeIds: string[];
}

export function filterFoundationsByComponents(foundations: FoundationsSchema, components: ComponentDoc[]): FoundationsSchema {
  // Collect all token names used by selected components
  const usedColorNames = new Set<string>();
  const usedTypographyNames = new Set<string>();
  const usedSpacingNames = new Set<string>();
  const usedGridNames = new Set<string>();

  components.forEach((comp) => {
    if (comp.tokenBindings) {
      comp.tokenBindings.colors?.forEach((binding) => {
        usedColorNames.add((binding as any)[1]);
      });
      comp.tokenBindings.typography?.forEach((binding) => {
        usedTypographyNames.add((binding as any)[1]);
      });
      comp.tokenBindings.spacing?.forEach((binding) => {
        usedSpacingNames.add((binding as any)[1]);
      });
      comp.tokenBindings.effects?.forEach((binding) => {
        usedGridNames.add((binding as any)[1]);
      });
    }
  });

  // Filter each foundation type to only include used tokens
  return {
    colors: foundations.colors.filter((color) => usedColorNames.has(color.tokenName)),
    typography: foundations.typography.filter((typo) => usedTypographyNames.has(typo.tokenName)),
    spacing: foundations.spacing.filter((spacing) => usedSpacingNames.has(spacing.tokenName)),
    borderRadius: foundations.borderRadius || [],
    borderWidth: foundations.borderWidth || [],
    elevation: foundations.elevation || [],
    grids: foundations.grids.filter((grid) => usedGridNames.has(grid.tokenName)),
  };
}

export function filterComponentsBySelection(components: ComponentsSchema, filter: SelectionFilter): ComponentsSchema {
  const selectedComps = components.components.filter((comp) =>
    filter.selectedNodeIds.includes(comp.id) ||
    comp.variants.some((v) => filter.selectedNodeIds.includes(v.nodeId))
  );

  return {
    components: selectedComps,
  };
}

export function getParentComponentName(components: ComponentDoc[]): string {
  if (components.length === 0) return 'components';
  if (components.length === 1) {
    const name = components[0].name;
    const parentName = name.split('/')[0];
    return parentName || name;
  }
  const names = components.map((c) => c.name.split('/')[0]);
  const uniqueParents = [...new Set(names)];
  return uniqueParents.length === 1 ? uniqueParents[0] : 'components';
}
