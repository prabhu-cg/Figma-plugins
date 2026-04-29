import type { VariantGroup, VariantGroupType } from '@/types/schemas';

const STATE_KEYWORDS = new Set([
  'default', 'hover', 'hovered', 'focus', 'focused', 'active', 'pressed',
  'disabled', 'error', 'loading', 'selected', 'checked', 'indeterminate',
  'empty', 'state',
]);

const VARIANT_KEYWORDS = new Set([
  'size', 'variant', 'type', 'style', 'color', 'emphasis', 'shape',
  'weight', 'layout', 'density',
]);

export function classifyVariantProperty(property: string): VariantGroupType {
  const lower = property.toLowerCase();
  if (STATE_KEYWORDS.has(lower)) return 'state';
  if (VARIANT_KEYWORDS.has(lower)) return 'variant';
  return 'variant';
}

export function classifyVariantValue(value: string): 'state' | 'variant' {
  return STATE_KEYWORDS.has(value.toLowerCase()) ? 'state' : 'variant';
}

export function extractStatesFromVariants(variantGroups: VariantGroup[]): string[] {
  const stateGroup = variantGroups.find(g => g.type === 'state');
  return stateGroup ? stateGroup.values : [];
}
