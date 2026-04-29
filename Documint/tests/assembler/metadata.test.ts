import { assembleMetadata } from '@/plugin/assembler/metadata';
import type { FoundationsSchema, ComponentsSchema } from '@/types/schemas';

const foundations: FoundationsSchema = {
  colors: [
    { id: 'c1', tokenName: 'color/primary', label: 'Primary', value: { hex: '#000', rgb: { r: 0, g: 0, b: 0 } }, semanticRole: 'primary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 21, contrastOnBlack: 1, wcagAA: true, wcagAAA: true, usageHint: '' },
    { id: 'c2', tokenName: 'color/secondary', label: 'Secondary', value: { hex: '#fff', rgb: { r: 255, g: 255, b: 255 } }, semanticRole: 'secondary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 1, contrastOnBlack: 21, wcagAA: true, wcagAAA: true, usageHint: '' },
  ],
  typography: [
    { id: 't1', tokenName: 'text/h1', label: 'H1', fontFamily: 'Inter', fontWeight: 700, fontSize: 32, lineHeight: { value: 40, unit: 'px' }, letterSpacing: { value: 0, unit: 'px' }, textCase: 'none', textDecoration: 'none', role: 'h1', source: 'style', usageHint: '' },
  ],
  spacing: [],
  grids: [],
};

const components: ComponentsSchema = {
  components: [
    {
      id: 'comp-1', name: 'Button', description: '', category: 'atom',
      anatomy: [], variantGroups: [],
      variants: [{ id: 'v1', combination: {}, nodeId: 'v1' }, { id: 'v2', combination: {}, nodeId: 'v2' }],
      states: [],
      tokenBindings: { colors: ['s1', 's2'], typography: ['t1'], spacing: [], effects: [] },
      accessibilityNotes: { role: 'button', keyboardInteraction: '', ariaAttributes: [] },
      usageGuidelines: { when: [], whenNot: [], antiPatterns: [] },
      doExamples: [], dontExamples: [],
    },
  ],
};

const source = { fileKey: 'abc123', fileName: 'My Design System', selectionIds: ['frame-1'] };

describe('assembleMetadata', () => {
  it('counts color and typography tokens correctly', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.counts.colorTokens).toBe(2);
    expect(meta.counts.typographyTokens).toBe(1);
    expect(meta.counts.spacingTokens).toBe(0);
    expect(meta.counts.gridTokens).toBe(0);
  });

  it('counts components and variants', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.counts.components).toBe(1);
    expect(meta.counts.variants).toBe(2);
  });

  it('counts total token bindings across all components', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.counts.tokenBindings).toBe(3); // 2 colors + 1 typography
  });

  it('copies source info unchanged', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.source.fileKey).toBe('abc123');
    expect(meta.source.fileName).toBe('My Design System');
    expect(meta.source.selectionIds).toEqual(['frame-1']);
  });

  it('sets plugin and schema version strings', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.pluginVersion).toBe('1.0.0');
    expect(meta.schemaVersion).toBe('1.0.0');
  });

  it('sets generatedAt to a valid ISO-8601 string', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(() => new Date(meta.generatedAt)).not.toThrow();
    expect(new Date(meta.generatedAt).toISOString()).toBe(meta.generatedAt);
  });

  it('includes all four export formats', () => {
    const meta = assembleMetadata(foundations, components, source);
    expect(meta.exportFormats).toEqual(['figma-page', 'markdown', 'html', 'json']);
  });
});
