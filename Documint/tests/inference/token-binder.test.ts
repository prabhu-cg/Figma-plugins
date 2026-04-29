import { detectTokenBindings } from '@/plugin/inference/token-binder';

describe('detectTokenBindings', () => {
  it('returns empty bindings for a node with no styles or fills', () => {
    const node = { id: 'n1', name: 'Empty', children: [] };
    const { bindings, hardcodedWarnings } = detectTokenBindings(node);
    expect(bindings.colors).toHaveLength(0);
    expect(bindings.typography).toHaveLength(0);
    expect(bindings.spacing).toHaveLength(0);
    expect(bindings.effects).toHaveLength(0);
    expect(hardcodedWarnings).toHaveLength(0);
  });

  it('detects fillStyleId as a color binding', () => {
    const node = { id: 'n2', name: 'Box', fillStyleId: 'style-abc', fills: [], children: [] };
    const { bindings, hardcodedWarnings } = detectTokenBindings(node);
    expect(bindings.colors).toContain('style-abc');
    expect(hardcodedWarnings).toHaveLength(0);
  });

  it('detects strokeStyleId as a color binding', () => {
    const node = { id: 'n3', name: 'Border', strokeStyleId: 'style-xyz', fills: [], children: [] };
    const { bindings } = detectTokenBindings(node);
    expect(bindings.colors).toContain('style-xyz');
  });

  it('detects textStyleId as a typography binding', () => {
    const node = { id: 'n4', name: 'Label', textStyleId: 'text-style-123', children: [] };
    const { bindings } = detectTokenBindings(node);
    expect(bindings.typography).toContain('text-style-123');
  });

  it('detects effectStyleId as an effect binding', () => {
    const node = { id: 'n5', name: 'Shadow', effectStyleId: 'effect-999', children: [] };
    const { bindings } = detectTokenBindings(node);
    expect(bindings.effects).toContain('effect-999');
  });

  it('generates HARDCODED_VALUE warning for a SOLID fill with no fillStyleId', () => {
    const node = { id: 'n6', name: 'Bg', fills: [{ type: 'SOLID' }], children: [] };
    const { hardcodedWarnings } = detectTokenBindings(node);
    expect(hardcodedWarnings).toHaveLength(1);
    expect(hardcodedWarnings[0].code).toBe('HARDCODED_VALUE');
    expect(hardcodedWarnings[0].itemId).toBe('n6');
  });

  it('does NOT warn for IMAGE or GRADIENT fills (not hardcoded colors)', () => {
    const node = { id: 'n7', name: 'Photo', fills: [{ type: 'IMAGE' }], children: [] };
    expect(detectTokenBindings(node).hardcodedWarnings).toHaveLength(0);
  });

  it('walks into children recursively', () => {
    const node = {
      id: 'n8', name: 'Parent', fills: [], children: [
        { id: 'n8-1', name: 'Child', fillStyleId: 'deep-style', fills: [], children: [] },
      ],
    };
    expect(detectTokenBindings(node).bindings.colors).toContain('deep-style');
  });

  it('detects variable alias in boundVariables fills as a color binding', () => {
    const node = {
      id: 'n9', name: 'Var', fills: [],
      boundVariables: { fills: [{ type: 'VARIABLE_ALIAS', id: 'var-color-1' }] },
      children: [],
    };
    expect(detectTokenBindings(node).bindings.colors).toContain('var-color-1');
  });

  it('detects variable alias in boundVariables itemSpacing as a spacing binding', () => {
    const node = {
      id: 'n10', name: 'Stack', fills: [],
      boundVariables: { itemSpacing: { type: 'VARIABLE_ALIAS', id: 'var-spacing-4' } },
      children: [],
    };
    expect(detectTokenBindings(node).bindings.spacing).toContain('var-spacing-4');
  });

  it('deduplicates repeated style IDs across children', () => {
    const node = {
      id: 'n11', name: 'Parent', fills: [], children: [
        { id: 'c1', name: 'A', fillStyleId: 'shared-style', fills: [], children: [] },
        { id: 'c2', name: 'B', fillStyleId: 'shared-style', fills: [], children: [] },
      ],
    };
    const { bindings } = detectTokenBindings(node);
    expect(bindings.colors.filter(id => id === 'shared-style')).toHaveLength(1);
  });
});
