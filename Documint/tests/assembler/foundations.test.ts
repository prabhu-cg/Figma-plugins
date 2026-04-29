import {
  buildColorToken,
  buildTypographyToken,
  buildSpacingToken,
  buildGridToken,
} from '@/plugin/assembler/foundations';

describe('buildColorToken', () => {
  it('builds uppercase hex string from 0-255 RGB values', () => {
    const token = buildColorToken('id-1', 'color/primary/500', 59, 130, 246, 'style');
    expect(token.value.hex).toBe('#3B82F6');
    expect(token.value.rgb).toEqual({ r: 59, g: 130, b: 246 });
  });

  it('sets tokenName and humanized label', () => {
    const token = buildColorToken('id', 'color/primary/500', 59, 130, 246, 'style');
    expect(token.tokenName).toBe('color/primary/500');
    expect(token.label).toBe('Primary 500');
  });

  it('infers semantic role from token name', () => {
    expect(buildColorToken('id', 'color/error/500', 220, 38, 38, 'style').semanticRole).toBe('error');
    expect(buildColorToken('id', 'color/primary/500', 59, 130, 246, 'style').semanticRole).toBe('primary');
    expect(buildColorToken('id', 'surface/base', 255, 255, 255, 'style').semanticRole).toBe('surface');
    expect(buildColorToken('id', 'color/neutral/400', 148, 163, 184, 'style').semanticRole).toBe('neutral');
  });

  it('computes contrast ratios against white and black', () => {
    const black = buildColorToken('id', 'color/text', 0, 0, 0, 'style');
    expect(black.contrastOnWhite).toBeGreaterThan(20);
    expect(black.contrastOnBlack).toBeCloseTo(1, 0);
  });

  it('sets wcagAA/AAA using the better of contrastOnWhite/contrastOnBlack', () => {
    const black = buildColorToken('id', 'color/text', 0, 0, 0, 'style');
    expect(black.wcagAA).toBe(true);
    expect(black.wcagAAA).toBe(true);

    const midGray = buildColorToken('id', 'color/mid', 119, 119, 119, 'style');
    expect(midGray.wcagAA).toBe(true);
  });

  it('sets usageHint describing best background context', () => {
    const white = buildColorToken('id', 'color/surface', 255, 255, 255, 'style');
    expect(white.usageHint).toContain('dark backgrounds');

    const black = buildColorToken('id', 'color/text', 0, 0, 0, 'style');
    expect(black.usageHint).toContain('light backgrounds');
  });

  it('copies aliases and source', () => {
    const token = buildColorToken('id', 'color/x', 100, 100, 100, 'variable', ['alias-1', 'alias-2']);
    expect(token.aliases).toEqual(['alias-1', 'alias-2']);
    expect(token.source).toBe('variable');
  });
});

describe('buildTypographyToken', () => {
  const lh = { value: 40, unit: 'PIXELS' };
  const ls = { value: -0.5, unit: 'PIXELS' };

  it('maps font style string to numeric weight', () => {
    const cases: [string, number][] = [
      ['Thin', 100], ['ExtraLight', 200], ['Light', 300], ['Regular', 400],
      ['Medium', 500], ['SemiBold', 600], ['Bold', 700], ['ExtraBold', 800], ['Black', 900],
    ];
    cases.forEach(([style, weight]) => {
      expect(
        buildTypographyToken('id', 'text/body', 'Inter', style, 16, { value: 24, unit: 'PIXELS' }, { value: 0, unit: 'PIXELS' }, 'NONE', 'NONE', 'style').fontWeight
      ).toBe(weight);
    });
  });

  it('maps Figma lineHeight units to schema units', () => {
    const px = buildTypographyToken('id', 'text/h1', 'Inter', 'Bold', 32, { value: 40, unit: 'PIXELS' }, ls, 'NONE', 'NONE', 'style');
    expect(px.lineHeight).toEqual({ value: 40, unit: 'px' });

    const pct = buildTypographyToken('id', 'text/h1', 'Inter', 'Bold', 32, { value: 150, unit: 'PERCENT' }, ls, 'NONE', 'NONE', 'style');
    expect(pct.lineHeight).toEqual({ value: 150, unit: '%' });

    const auto = buildTypographyToken('id', 'text/h1', 'Inter', 'Bold', 32, { value: 0, unit: 'AUTO' }, ls, 'NONE', 'NONE', 'style');
    expect(auto.lineHeight.unit).toBe('auto');
  });

  it('maps Figma textCase values to schema values', () => {
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'UPPER', 'NONE', 'style').textCase).toBe('uppercase');
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'LOWER', 'NONE', 'style').textCase).toBe('lowercase');
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'TITLE', 'NONE', 'style').textCase).toBe('capitalize');
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'NONE', 'NONE', 'style').textCase).toBe('none');
  });

  it('maps Figma textDecoration values to schema values', () => {
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'NONE', 'UNDERLINE', 'style').textDecoration).toBe('underline');
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'NONE', 'STRIKETHROUGH', 'style').textDecoration).toBe('strikethrough');
  });

  it('infers typography role from token name', () => {
    expect(buildTypographyToken('id', 'text/heading/h1', 'Inter', 'Bold', 32, lh, ls, 'NONE', 'NONE', 'style').role).toBe('h1');
    expect(buildTypographyToken('id', 'text/body', 'Inter', 'Regular', 16, lh, ls, 'NONE', 'NONE', 'style').role).toBe('body-md');
    expect(buildTypographyToken('id', 'text/caption', 'Inter', 'Regular', 12, lh, ls, 'NONE', 'NONE', 'style').role).toBe('caption');
  });
});

describe('buildSpacingToken', () => {
  it('parses numeric scale step from token name suffix', () => {
    const token = buildSpacingToken('spacing/4', 16);
    expect(token.value).toBe(16);
    expect(token.unit).toBe('px');
    expect(token.scaleStep).toBe(4);
    expect(token.scaleBase).toBe(4);
  });

  it('sets scaleStep to 0 when name suffix is not numeric', () => {
    const token = buildSpacingToken('spacing/sm', 8);
    expect(token.scaleStep).toBe(0);
    expect(token.scaleBase).toBe(0);
  });

  it('humanizes the label', () => {
    expect(buildSpacingToken('spacing/8', 32).label).toBeTruthy();
  });
});

describe('buildGridToken', () => {
  it('maps COLUMNS pattern to columns type', () => {
    const token = buildGridToken('grid/desktop', 'COLUMNS', 12, 16, 24, 0);
    expect(token.type).toBe('columns');
    expect(token.count).toBe(12);
    expect(token.gutter).toBe(16);
    expect(token.margin).toBe(24);
  });

  it('maps ROWS pattern to rows type', () => {
    expect(buildGridToken('grid/rows', 'ROWS', 6, 8, 0, 64).type).toBe('rows');
  });

  it('maps GRID pattern to grid type', () => {
    expect(buildGridToken('grid/base', 'GRID', 0, 0, 0, 8).type).toBe('grid');
  });

  it('infers breakpoint hint from name keywords', () => {
    expect(buildGridToken('grid/mobile', 'COLUMNS', 4, 16, 16, 0).breakpointHint).toBe('mobile');
    expect(buildGridToken('grid/tablet', 'COLUMNS', 8, 16, 24, 0).breakpointHint).toBe('tablet');
    expect(buildGridToken('grid/desktop', 'COLUMNS', 12, 24, 32, 0).breakpointHint).toBe('desktop');
    expect(buildGridToken('grid/wide', 'COLUMNS', 16, 32, 48, 0).breakpointHint).toBe('wide');
    expect(buildGridToken('grid/base', 'COLUMNS', 12, 16, 0, 0).breakpointHint).toBe('unknown');
  });
});
