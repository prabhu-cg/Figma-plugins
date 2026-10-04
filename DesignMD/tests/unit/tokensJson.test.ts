import { describe, expect, it } from 'vitest';
import { generateTokensJson } from '../../src/plugin/generators/tokensJson';
import { makeDesignSystem } from './fixtures';

describe('generateTokensJson', () => {
  it('produces tokens.json with the expected path', () => {
    const file = generateTokensJson(makeDesignSystem());
    expect(file.path).toBe('tokens.json');
  });

  it('produces valid JSON with metadata and category buckets', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.metadata.fileName).toBe('Fixture File');
    expect(parsed.color).toBeDefined();
    expect(parsed.semantic).toBeDefined();
  });

  it('nests color variable under its stripped path and resolves the default value to hex', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Primary['500'].$value).toBe('#3366ff');
    expect(parsed.color.Primary['500'].$type).toBe('color');
  });

  it('represents alias values as a DTCG-style reference', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.semantic.Color.Danger.$value).toBe('{color.Primary.500}');
  });

  it('lists the components that bind a variable under $extensions.figma.usedBy', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Primary['500'].$extensions.figma.usedBy).toEqual(['Button']);
    expect(parsed.semantic.Color.Danger.$extensions.figma.usedBy).toEqual([]);
  });

  it('falls back to color styles when no color variables exist', () => {
    const ds = makeDesignSystem();
    ds.variables = ds.variables.filter((v) => v.category !== 'color' && v.category !== 'semantic');
    const file = generateTokensJson(ds);
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Surface.Background.$value).toBe('#ffffff');
  });

  it('handles an empty design system without throwing', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles = { text: [], color: [], effect: [], grid: [] };
    expect(() => generateTokensJson(ds)).not.toThrow();
  });
});

describe('generateTokensJson DTCG output', () => {
  function lookup(tree: Record<string, unknown>, ref: string): unknown {
    return ref
      .slice(1, -1)
      .split('.')
      .reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);
  }

  it('does not emit a $schema URL', () => {
    const parsed = JSON.parse(generateTokensJson(makeDesignSystem()).content);
    expect(parsed.$schema).toBeUndefined();
  });

  it('alias references point at the real location of the target token', () => {
    const ds = makeDesignSystem();
    // No category prefix in the name, so the tree path is color.Brand.Primary.
    ds.variables[0].name = 'Brand/Primary';
    ds.variables[0].path = ['Brand', 'Primary'];
    ds.variables[1].valuesByMode[0].value = {
      kind: 'alias',
      variableId: ds.variables[0].id,
      variableName: 'Brand/Primary',
    };
    const parsed = JSON.parse(generateTokensJson(ds).content);
    const ref = parsed.semantic.Color.Danger.$value as string;
    expect(ref).toBe('{color.Brand.Primary}');
    expect((lookup(parsed, ref) as { $value: string }).$value).toBe('#3366ff');
  });

  it('exports text styles as a DTCG typography composite', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    const parsed = JSON.parse(generateTokensJson(ds).content);
    const heading = parsed.typography.Heading.Large;
    expect(heading.$type).toBe('typography');
    expect(heading.$value).toEqual({
      fontFamily: 'Inter',
      fontSize: '32px',
      fontWeight: 700,
      letterSpacing: '0px',
      lineHeight: 1.2,
    });
  });

  it('exports drop shadows as a DTCG shadow composite', () => {
    const parsed = JSON.parse(generateTokensJson(makeDesignSystem()).content);
    expect(parsed.effect.Elevation.Card.$type).toBe('shadow');
    expect(parsed.effect.Elevation.Card.$value).toMatchObject({
      offsetY: '2px',
      blur: '8px',
    });
  });

  it('types spacing floats as dimensions with a px unit', () => {
    const ds = makeDesignSystem();
    ds.variables.push({
      ...ds.variables[0],
      id: 'var:space',
      name: 'Spacing/md',
      path: ['Spacing', 'md'],
      resolvedType: 'FLOAT',
      category: 'spacing',
      valuesByMode: [
        { modeId: 'mode:light', modeName: 'Light', value: { kind: 'float', value: 16 } },
      ],
    });
    const parsed = JSON.parse(generateTokensJson(ds).content);
    expect(parsed.spacing.md.$type).toBe('dimension');
    expect(parsed.spacing.md.$value).toBe('16px');
  });

  it('omits gradient/image color styles instead of emitting a null value', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles.color = [
      {
        ...ds.styles.color[0],
        id: 'g',
        name: 'Surface/Gradient',
        path: ['Surface', 'Gradient'],
        paint: undefined,
        paintIsGradientOrImage: true,
      },
    ];
    const parsed = JSON.parse(generateTokensJson(ds).content);
    expect(parsed.color.Surface).toBeUndefined();
  });

  it('keeps "." out of path segments so references stay unambiguous', () => {
    const ds = makeDesignSystem();
    ds.variables[0].path = ['Color', 'Primary', '0.5'];
    const parsed = JSON.parse(generateTokensJson(ds).content);
    expect(parsed.color.Primary['0-5']).toBeDefined();
  });
});
