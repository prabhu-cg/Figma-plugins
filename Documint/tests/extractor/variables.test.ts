import { extractColorVariables, extractSpacingVariables } from '@/plugin/extractor/variables';

describe('extractColorVariables', () => {
  it('returns empty array when no color variables exist', () => {
    (global as any).figma.variables.getLocalVariables.mockReturnValue([]);
    (global as any).figma.variables.getLocalVariableCollections.mockReturnValue([]);
    expect(extractColorVariables()).toEqual([]);
  });

  it('maps a color variable with its collection name', () => {
    (global as any).figma.variables.getLocalVariableCollections.mockReturnValue([
      { id: 'coll-1', name: 'Primitives' },
    ]);
    (global as any).figma.variables.getLocalVariables.mockReturnValue([
      {
        id: 'var-1',
        name: 'color/brand/500',
        variableCollectionId: 'coll-1',
        resolvedType: 'COLOR',
        valuesByMode: { 'mode-1': { r: 0.23, g: 0.51, b: 0.96, a: 1 } },
      },
    ]);
    const result = extractColorVariables();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('var-1');
    expect(result[0].name).toBe('color/brand/500');
    expect(result[0].collectionName).toBe('Primitives');
    expect(result[0].collectionId).toBe('coll-1');
  });

  it('uses empty string for collection name when collection not found', () => {
    (global as any).figma.variables.getLocalVariableCollections.mockReturnValue([]);
    (global as any).figma.variables.getLocalVariables.mockReturnValue([
      { id: 'var-2', name: 'color/x', variableCollectionId: 'missing', resolvedType: 'COLOR', valuesByMode: {} },
    ]);
    const result = extractColorVariables();
    expect(result[0].collectionName).toBe('');
  });
});

describe('extractSpacingVariables', () => {
  beforeEach(() => {
    (global as any).figma.variables.getLocalVariableCollections.mockReturnValue([]);
  });

  it('returns only FLOAT variables whose names contain spacing keywords', () => {
    (global as any).figma.variables.getLocalVariables.mockReturnValue([
      { id: 'v1', name: 'spacing/4', variableCollectionId: '', resolvedType: 'FLOAT', valuesByMode: {} },
      { id: 'v2', name: 'border-radius/md', variableCollectionId: '', resolvedType: 'FLOAT', valuesByMode: {} },
      { id: 'v3', name: 'gap/lg', variableCollectionId: '', resolvedType: 'FLOAT', valuesByMode: {} },
      { id: 'v4', name: 'padding/sm', variableCollectionId: '', resolvedType: 'FLOAT', valuesByMode: {} },
    ]);
    const result = extractSpacingVariables();
    expect(result.map(v => v.id)).toEqual(['v1', 'v3', 'v4']);
  });

  it('returns empty array when no spacing-named variables exist', () => {
    (global as any).figma.variables.getLocalVariables.mockReturnValue([
      { id: 'v1', name: 'border-radius/sm', variableCollectionId: '', resolvedType: 'FLOAT', valuesByMode: {} },
    ]);
    expect(extractSpacingVariables()).toEqual([]);
  });
});
