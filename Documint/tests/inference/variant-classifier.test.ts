import {
  classifyVariantProperty,
  classifyVariantValue,
  extractStatesFromVariants,
} from '@/plugin/inference/variant-classifier';

describe('classifyVariantProperty', () => {
  it.each([
    ['State', 'state'],
    ['state', 'state'],
    ['Size', 'variant'],
    ['Type', 'variant'],
    ['Variant', 'variant'],
    ['style', 'variant'],
    ['emphasis', 'variant'],
    ['density', 'variant'],
    ['Unknown', 'variant'],
  ] as [string, string][])(
    '"%s" → "%s"',
    (prop, expected) => {
      expect(classifyVariantProperty(prop)).toBe(expected);
    }
  );
});

describe('classifyVariantValue', () => {
  it.each([
    ['hover', 'state'],
    ['Hover', 'state'],
    ['focused', 'state'],
    ['disabled', 'state'],
    ['loading', 'state'],
    ['selected', 'state'],
    ['sm', 'variant'],
    ['primary', 'variant'],
    ['filled', 'variant'],
  ] as [string, string][])(
    '"%s" → "%s"',
    (value, expected) => {
      expect(classifyVariantValue(value)).toBe(expected);
    }
  );
});

describe('extractStatesFromVariants', () => {
  it('collects unique state values from a State property', () => {
    const variantGroups = [
      { property: 'State', type: 'state' as const, values: ['default', 'hover', 'disabled'] },
      { property: 'Size', type: 'variant' as const, values: ['sm', 'md', 'lg'] },
    ];
    expect(extractStatesFromVariants(variantGroups)).toEqual(['default', 'hover', 'disabled']);
  });

  it('returns empty array when no state group exists', () => {
    const variantGroups = [
      { property: 'Size', type: 'variant' as const, values: ['sm', 'md'] },
    ];
    expect(extractStatesFromVariants(variantGroups)).toEqual([]);
  });
});
