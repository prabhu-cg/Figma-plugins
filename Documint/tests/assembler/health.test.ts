import { detectNamingPatterns, generateWarnings, assembleHealth } from '@/plugin/assembler/health';
import type { FoundationsSchema, ComponentsSchema, ComponentDoc } from '@/types/schemas';

const emptyFoundations: FoundationsSchema = { colors: [], typography: [], spacing: [], grids: [] };
const emptyComponents: ComponentsSchema = { components: [] };

function makeComponent(overrides: Partial<ComponentDoc> = {}): ComponentDoc {
  return {
    id: 'comp-1', name: 'Button', description: 'A button', category: 'atom',
    anatomy: [],
    variantGroups: [{ property: 'Size', type: 'variant', values: ['sm', 'md'] }],
    variants: [],
    states: ['default', 'hover', 'disabled'],
    tokenBindings: { colors: ['style-1'], typography: ['text-1'], spacing: [], effects: [] },
    accessibilityNotes: { role: 'button', keyboardInteraction: 'Enter', ariaAttributes: [] },
    usageGuidelines: { when: [], whenNot: [], antiPatterns: [] },
    doExamples: [], dontExamples: [],
    ...overrides,
  };
}

describe('detectNamingPatterns', () => {
  it('reports consistent: true when all names use the same separator', () => {
    const result = detectNamingPatterns(['color/primary/500', 'color/secondary/400', 'text/h1']);
    expect(result.consistent).toBe(true);
    expect(result.detected).toEqual(['slash-separated']);
  });

  it('reports consistent: false when multiple separators are used', () => {
    const result = detectNamingPatterns(['color/primary', 'colorPrimary']);
    expect(result.consistent).toBe(false);
    expect(result.detected).toContain('slash-separated');
    expect(result.detected).toContain('camelCase');
  });

  it('reports consistent: true for an empty token list', () => {
    expect(detectNamingPatterns([]).consistent).toBe(true);
  });

  it('detects dot-separated convention', () => {
    const result = detectNamingPatterns(['color.primary.500', 'text.h1']);
    expect(result.detected).toContain('dot-separated');
    expect(result.consistent).toBe(true);
  });
});

describe('generateWarnings', () => {
  it('generates MISSING_DESCRIPTION for a component with no description', () => {
    const comp = makeComponent({ description: '' });
    const warnings = generateWarnings(emptyFoundations, { components: [comp] });
    const w = warnings.find(w => w.code === 'MISSING_DESCRIPTION');
    expect(w).toBeDefined();
    expect(w?.severity).toBe('warning');
    expect(w?.domain).toBe('components');
  });

  it('generates NO_STATES for a component with no states', () => {
    const comp = makeComponent({ states: [] });
    const warnings = generateWarnings(emptyFoundations, { components: [comp] });
    expect(warnings.some(w => w.code === 'NO_STATES')).toBe(true);
  });

  it('generates NO_VARIANTS for a component with neither states nor variant groups', () => {
    const comp = makeComponent({ states: [], variantGroups: [] });
    const warnings = generateWarnings(emptyFoundations, { components: [comp] });
    expect(warnings.some(w => w.code === 'NO_VARIANTS')).toBe(true);
  });

  it('generates no warnings for a well-formed component', () => {
    const comp = makeComponent(); // has description, states, and variants
    expect(generateWarnings(emptyFoundations, { components: [comp] })).toHaveLength(0);
  });

  it('generates multiple warnings for multiple components', () => {
    const bad1 = makeComponent({ id: 'c1', name: 'BadA', description: '' });
    const bad2 = makeComponent({ id: 'c2', name: 'BadB', description: '', states: [] });
    const warnings = generateWarnings(emptyFoundations, { components: [bad1, bad2] });
    expect(warnings.some(w => w.itemId === 'c1')).toBe(true);
    expect(warnings.some(w => w.itemId === 'c2')).toBe(true);
  });
});

describe('assembleHealth', () => {
  it('returns overallScore 0 for empty foundations and components', () => {
    expect(assembleHealth(emptyFoundations, emptyComponents).overallScore).toBe(0);
  });

  it('gives foundationsScore 100 when all colors have semantic roles', () => {
    const foundations: FoundationsSchema = {
      ...emptyFoundations,
      colors: [
        { id: 'c1', tokenName: 'color/primary', label: 'Primary', value: { hex: '#3B82F6', rgb: { r: 59, g: 130, b: 246 } }, semanticRole: 'primary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 4.52, contrastOnBlack: 4.64, wcagAA: true, wcagAAA: false, usageHint: '' },
      ],
    };
    expect(assembleHealth(foundations, emptyComponents).breakdown.foundationsScore).toBe(100);
  });

  it('gives foundationsScore < 100 when some colors are unknown role', () => {
    const foundations: FoundationsSchema = {
      ...emptyFoundations,
      colors: [
        { id: 'c1', tokenName: 'color/primary', label: 'Primary', value: { hex: '#000', rgb: { r: 0, g: 0, b: 0 } }, semanticRole: 'primary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 21, contrastOnBlack: 1, wcagAA: true, wcagAAA: true, usageHint: '' },
        { id: 'c2', tokenName: 'xyz-token', label: 'XYZ', value: { hex: '#fff', rgb: { r: 255, g: 255, b: 255 } }, semanticRole: 'unknown', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 1, contrastOnBlack: 21, wcagAA: true, wcagAAA: true, usageHint: '' },
      ],
    };
    expect(assembleHealth(foundations, emptyComponents).breakdown.foundationsScore).toBe(50);
  });

  it('gives componentsScore 100 for a fully described component with states and bindings', () => {
    const comp = makeComponent();
    expect(assembleHealth(emptyFoundations, { components: [comp] }).breakdown.componentsScore).toBe(100);
  });

  it('gives tokenCoverageScore 100 when all components have token bindings', () => {
    const comp = makeComponent();
    expect(assembleHealth(emptyFoundations, { components: [comp] }).breakdown.tokenCoverageScore).toBe(100);
  });

  it('gives tokenCoverageScore 0 when no components have token bindings', () => {
    const comp = makeComponent({ tokenBindings: { colors: [], typography: [], spacing: [], effects: [] } });
    expect(assembleHealth(emptyFoundations, { components: [comp] }).breakdown.tokenCoverageScore).toBe(0);
  });

  it('gives namingConsistencyScore 100 for consistent token names', () => {
    const foundations: FoundationsSchema = {
      ...emptyFoundations,
      colors: [
        { id: 'c1', tokenName: 'color/primary', label: 'Primary', value: { hex: '#000', rgb: { r: 0, g: 0, b: 0 } }, semanticRole: 'primary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 21, contrastOnBlack: 1, wcagAA: true, wcagAAA: true, usageHint: '' },
        { id: 'c2', tokenName: 'color/secondary', label: 'Secondary', value: { hex: '#fff', rgb: { r: 255, g: 255, b: 255 } }, semanticRole: 'secondary', source: 'style', variableMode: null, aliases: [], contrastOnWhite: 1, contrastOnBlack: 21, wcagAA: true, wcagAAA: true, usageHint: '' },
      ],
    };
    expect(assembleHealth(foundations, emptyComponents).breakdown.namingConsistencyScore).toBe(100);
  });

  it('includes extra hardcoded-value warnings in output', () => {
    const extra = {
      severity: 'warning' as const, domain: 'components' as const,
      itemId: 'c1', itemName: 'Button',
      code: 'HARDCODED_VALUE' as const,
      message: 'Layer uses hardcoded color', suggestion: 'Use a token',
    };
    const health = assembleHealth(emptyFoundations, emptyComponents, [extra]);
    expect(health.warnings).toContainEqual(extra);
  });

  it('overall score is between 0 and 100', () => {
    const comp = makeComponent();
    const score = assembleHealth(emptyFoundations, { components: [comp] }).overallScore;
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});
