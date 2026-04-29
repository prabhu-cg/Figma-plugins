import { extractComponents } from '@/plugin/extractor/components';

describe('extractComponents', () => {
  it('returns empty result for empty selection', () => {
    const result = extractComponents([]);
    expect(result.components).toHaveLength(0);
    expect(result.variantsByComponentId).toEqual({});
  });

  it('ignores non-component nodes (FRAME, GROUP, etc.)', () => {
    const selection = [{ type: 'FRAME', id: 'f1', name: 'Layout' }];
    expect(extractComponents(selection).components).toHaveLength(0);
  });

  it('extracts a COMPONENT_SET with its COMPONENT children as variants', () => {
    const selection = [
      {
        type: 'COMPONENT_SET',
        id: 'set-1', name: 'Button', description: 'A button',
        componentPropertyDefinitions: {
          Size: { type: 'VARIANT', variantOptions: ['sm', 'md', 'lg'] },
        },
        children: [
          {
            type: 'COMPONENT', id: 'v1', name: 'Size=sm',
            componentProperties: { Size: { value: 'sm' } },
            children: [], fills: [], strokes: [], effects: [],
            fillStyleId: '', textStyleId: '', effectStyleId: '',
          },
          {
            type: 'COMPONENT', id: 'v2', name: 'Size=md',
            componentProperties: { Size: { value: 'md' } },
            children: [], fills: [], strokes: [], effects: [],
            fillStyleId: '', textStyleId: '', effectStyleId: '',
          },
        ],
        fills: [], strokes: [], effects: [],
        fillStyleId: '', strokeStyleId: '', effectStyleId: '', boundVariables: {},
      },
    ];

    const result = extractComponents(selection);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].name).toBe('Button');
    expect(result.components[0].description).toBe('A button');
    expect(result.variantsByComponentId['set-1']).toHaveLength(2);
    expect(result.variantsByComponentId['set-1'][0].id).toBe('v1');
    expect(result.variantsByComponentId['set-1'][1].name).toBe('Size=md');
  });

  it('extracts a standalone COMPONENT with empty variants array', () => {
    const selection = [
      {
        type: 'COMPONENT', id: 'comp-1', name: 'Icon', description: '',
        componentPropertyDefinitions: {},
        children: [], fills: [], strokes: [], effects: [],
        fillStyleId: '', strokeStyleId: '', effectStyleId: '', boundVariables: {},
      },
    ];
    const result = extractComponents(selection);
    expect(result.components).toHaveLength(1);
    expect(result.components[0].name).toBe('Icon');
    expect(result.variantsByComponentId['comp-1']).toEqual([]);
  });

  it('omits non-COMPONENT children of a COMPONENT_SET', () => {
    const selection = [
      {
        type: 'COMPONENT_SET',
        id: 'set-2', name: 'Card', description: '',
        componentPropertyDefinitions: {},
        children: [
          { type: 'FRAME', id: 'fr1', name: 'divider' },
          { type: 'COMPONENT', id: 'v1', name: 'default', componentProperties: {}, children: [], fills: [], strokes: [], effects: [], fillStyleId: '', textStyleId: '', effectStyleId: '' },
        ],
        fills: [], strokes: [], effects: [],
        fillStyleId: '', strokeStyleId: '', effectStyleId: '', boundVariables: {},
      },
    ];
    const result = extractComponents(selection);
    expect(result.variantsByComponentId['set-2']).toHaveLength(1);
  });
});
