import { buildVariantGroups, buildVariants, buildComponentDoc } from '@/plugin/assembler/components';
import type { TokenBindings } from '@/types/schemas';

const emptyBindings: TokenBindings = { colors: [], typography: [], spacing: [], effects: [] };

describe('buildVariantGroups', () => {
  it('includes only VARIANT type definitions, ignores TEXT and BOOLEAN', () => {
    const defs = {
      Size:    { type: 'VARIANT', variantOptions: ['sm', 'md', 'lg'] },
      Label:   { type: 'TEXT', variantOptions: [] },
      Visible: { type: 'BOOLEAN', variantOptions: [] },
      State:   { type: 'VARIANT', variantOptions: ['default', 'hover', 'disabled'] },
    };
    const groups = buildVariantGroups(defs);
    expect(groups).toHaveLength(2);
    expect(groups.map(g => g.property)).toEqual(['Size', 'State']);
  });

  it('classifies a property named "State" as type "state"', () => {
    const defs = { State: { type: 'VARIANT', variantOptions: ['default', 'hover'] } };
    expect(buildVariantGroups(defs)[0].type).toBe('state');
  });

  it('classifies a property named "Size" as type "variant"', () => {
    const defs = { Size: { type: 'VARIANT', variantOptions: ['sm', 'md'] } };
    expect(buildVariantGroups(defs)[0].type).toBe('variant');
  });

  it('returns empty array when no VARIANT definitions exist', () => {
    expect(buildVariantGroups({ Text: { type: 'TEXT' } })).toEqual([]);
  });
});

describe('buildVariants', () => {
  it('maps componentProperties to variant combinations', () => {
    const variantNodes = [
      { id: 'v1', name: 'Size=sm,State=default', componentProperties: { Size: { value: 'sm' }, State: { value: 'default' } } },
      { id: 'v2', name: 'Size=md,State=hover',   componentProperties: { Size: { value: 'md' }, State: { value: 'hover' } } },
    ];
    const variants = buildVariants(variantNodes);
    expect(variants).toHaveLength(2);
    expect(variants[0]).toEqual({ id: 'v1', combination: { Size: 'sm', State: 'default' }, nodeId: 'v1' });
    expect(variants[1].combination).toEqual({ Size: 'md', State: 'hover' });
  });

  it('returns empty array for empty input', () => {
    expect(buildVariants([])).toEqual([]);
  });
});

describe('buildComponentDoc', () => {
  const rawComp = {
    id: 'comp-1', name: 'Button', description: 'A primary action button',
    componentPropertyDefinitions: {
      Size:  { type: 'VARIANT', variantOptions: ['sm', 'md', 'lg'] },
      State: { type: 'VARIANT', variantOptions: ['default', 'hover', 'disabled'] },
    },
    children: [
      { id: 'child-1', name: 'label' },
      { id: 'child-2', name: 'icon' },
      { id: 'child-3', name: 'container' },
    ],
  };
  const variantNodes = [
    { id: 'v1', name: 'Size=sm,State=default', componentProperties: { Size: { value: 'sm' }, State: { value: 'default' } } },
  ];
  const bindings: TokenBindings = { colors: ['style-1'], typography: ['text-1'], spacing: [], effects: [] };

  it('maps children to anatomy parts with inferred roles', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, bindings);
    expect(doc.anatomy).toHaveLength(3);
    expect(doc.anatomy.find(a => a.partName === 'label')?.role).toBe('text');
    expect(doc.anatomy.find(a => a.partName === 'icon')?.role).toBe('icon');
    expect(doc.anatomy.find(a => a.partName === 'container')?.role).toBe('container');
  });

  it('extracts states from the State variant group', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, bindings);
    expect(doc.states).toEqual(['default', 'hover', 'disabled']);
  });

  it('infers component category from name', () => {
    expect(buildComponentDoc(rawComp, variantNodes, bindings).category).toBe('atom');
  });

  it('infers accessibility role from name', () => {
    expect(buildComponentDoc(rawComp, variantNodes, bindings).accessibilityNotes.role).toBe('button');
  });

  it('sets keyboard interaction description', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, bindings);
    expect(doc.accessibilityNotes.keyboardInteraction).toContain('Enter');
  });

  it('passes through token bindings', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, bindings);
    expect(doc.tokenBindings).toEqual(bindings);
  });

  it('sets id, name, description correctly', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, bindings);
    expect(doc.id).toBe('comp-1');
    expect(doc.name).toBe('Button');
    expect(doc.description).toBe('A primary action button');
  });

  it('initializes usageGuidelines and examples as empty arrays', () => {
    const doc = buildComponentDoc(rawComp, variantNodes, emptyBindings);
    expect(doc.usageGuidelines.when).toEqual([]);
    expect(doc.doExamples).toEqual([]);
    expect(doc.dontExamples).toEqual([]);
  });
});
