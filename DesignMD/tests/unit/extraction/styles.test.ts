import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectBoundVariableIds,
  extractEffectStyles,
  extractGridStyles,
  extractPaintStyles,
  extractTextStyles,
} from '../../../src/plugin/extraction/styles';
import {
  alias,
  fakeEffectStyle,
  fakeGridStyle,
  fakePaintStyle,
  fakeTextStyle,
  installFakeFigma,
} from '../helpers/fakeFigma';

afterEach(() => vi.unstubAllGlobals());

describe('collectBoundVariableIds', () => {
  it('finds aliases nested in objects and arrays, deduplicated', () => {
    const bound = {
      fills: [alias('v1'), alias('v2')],
      width: alias('v1'),
      componentProperties: { label: { nested: alias('v3') } },
    };
    expect(collectBoundVariableIds(bound).sort()).toEqual(['v1', 'v2', 'v3']);
  });

  it('ignores empty, non-alias, and non-object values', () => {
    expect(collectBoundVariableIds(undefined)).toEqual([]);
    expect(collectBoundVariableIds({ fills: [] })).toEqual([]);
    expect(collectBoundVariableIds({ a: { type: 'SOLID', id: 'x' }, b: 3, c: 'str' })).toEqual([]);
  });
});

describe('extractTextStyles', () => {
  it('maps font, size, spacing, and case properties', async () => {
    installFakeFigma({ textStyles: [fakeTextStyle()] });
    const [style] = await extractTextStyles();
    expect(style).toMatchObject({
      id: 'S:text:1',
      name: 'Heading/Large',
      fontFamily: 'Inter',
      fontStyle: 'Bold',
      fontWeight: 700,
      fontSize: 32,
      lineHeight: '120%',
      letterSpacing: '0px',
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      paragraphSpacing: 0,
    });
  });

  it('formats AUTO, pixel, and percent line heights and letter spacing', async () => {
    installFakeFigma({
      textStyles: [
        fakeTextStyle({
          id: 'a',
          lineHeight: { unit: 'AUTO' },
          letterSpacing: { unit: 'PERCENT', value: 2 },
        }),
        fakeTextStyle({ id: 'b', lineHeight: { unit: 'PIXELS', value: 24 } }),
      ],
    });
    const [a, b] = await extractTextStyles();
    expect(a).toMatchObject({ lineHeight: 'AUTO', letterSpacing: '2%' });
    expect(b.lineHeight).toBe('24px');
  });

  it('derives the font weight from the font style name', async () => {
    installFakeFigma({
      textStyles: [
        fakeTextStyle({ id: 'a', fontName: { family: 'Inter', style: 'Semi Bold Italic' } }),
        fakeTextStyle({ id: 'b', fontName: { family: 'Inter', style: 'Regular' } }),
      ],
    });
    const styles = await extractTextStyles();
    expect(styles.map((s) => s.fontWeight)).toEqual([600, 400]);
  });

  it('records variables bound inside the style', async () => {
    installFakeFigma({
      textStyles: [
        fakeTextStyle({
          boundVariables: { fontSize: alias('v-size'), fontFamily: alias('v-fam') },
        }),
      ],
    });
    const [style] = await extractTextStyles();
    expect(style.boundVariableIds.sort()).toEqual(['v-fam', 'v-size']);
  });

  it('warns and returns nothing when styles cannot be loaded', async () => {
    installFakeFigma({ failures: { textStyles: true } });
    const warnings: string[] = [];
    const styles = await extractTextStyles(undefined, (m) => warnings.push(m));
    expect(styles).toEqual([]);
    expect(warnings[0]).toContain('Failed to load text styles');
  });
});

describe('extractPaintStyles', () => {
  it('maps a solid paint including its opacity', async () => {
    installFakeFigma({
      paintStyles: [
        fakePaintStyle({
          paints: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 1 }, opacity: 0.5, visible: true }],
        }),
      ],
    });
    const [style] = await extractPaintStyles();
    expect(style.color).toEqual({ r: 0.2, g: 0.4, b: 1, a: 0.5 });
    expect(style.isGradientOrImage).toBe(false);
  });

  it('defaults a missing opacity to 1', async () => {
    installFakeFigma({
      paintStyles: [fakePaintStyle({ paints: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }] })],
    });
    const [style] = await extractPaintStyles();
    expect(style.color?.a).toBe(1);
  });

  it('flags gradients as non-solid and exposes no color when there is no solid paint', async () => {
    installFakeFigma({
      paintStyles: [fakePaintStyle({ paints: [{ type: 'GRADIENT_LINEAR', visible: true }] })],
    });
    const [style] = await extractPaintStyles();
    expect(style.color).toBeNull();
    expect(style.isGradientOrImage).toBe(true);
  });

  it('skips invisible solid paints but still flags mixed stacks', async () => {
    installFakeFigma({
      paintStyles: [
        fakePaintStyle({
          paints: [
            { type: 'SOLID', color: { r: 1, g: 0, b: 0 }, visible: false },
            { type: 'SOLID', color: { r: 0, g: 1, b: 0 }, visible: true },
            { type: 'IMAGE', visible: true },
          ],
        }),
      ],
    });
    const [style] = await extractPaintStyles();
    expect(style.color).toMatchObject({ r: 0, g: 1, b: 0 });
    expect(style.isGradientOrImage).toBe(true);
  });

  it('warns when color styles cannot be loaded', async () => {
    installFakeFigma({ failures: { paintStyles: true } });
    const warnings: string[] = [];
    expect(await extractPaintStyles(undefined, (m) => warnings.push(m))).toEqual([]);
    expect(warnings[0]).toContain('Failed to load color styles');
  });
});

describe('extractEffectStyles', () => {
  it('maps shadows with offset, radius, spread, and color', async () => {
    installFakeFigma({ effectStyles: [fakeEffectStyle()] });
    const [style] = await extractEffectStyles();
    expect(style.effects).toEqual([
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offsetX: 0,
        offsetY: 2,
        radius: 8,
        spread: 1,
      },
    ]);
  });

  it('defaults a missing spread to 0 and maps blurs by radius only', async () => {
    installFakeFigma({
      effectStyles: [
        fakeEffectStyle({
          effects: [
            {
              type: 'INNER_SHADOW',
              visible: true,
              color: { r: 0, g: 0, b: 0, a: 1 },
              offset: { x: 1, y: 1 },
              radius: 2,
            },
            { type: 'LAYER_BLUR', visible: true, radius: 12 },
            { type: 'BACKGROUND_BLUR', visible: false, radius: 4 },
          ],
        }),
      ],
    });
    const [style] = await extractEffectStyles();
    expect(style.effects[0].spread).toBe(0);
    expect(style.effects[1]).toEqual({ type: 'LAYER_BLUR', visible: true, radius: 12 });
    expect(style.effects[2].visible).toBe(false);
  });
});

describe('extractGridStyles', () => {
  it('maps column grids and leaves absent fields undefined', async () => {
    installFakeFigma({
      gridStyles: [
        fakeGridStyle(),
        fakeGridStyle({ id: 'g2', layoutGrids: [{ pattern: 'GRID', sectionSize: 8 }] }),
      ],
    });
    const [columns, square] = await extractGridStyles();
    expect(columns.grids[0]).toEqual({
      pattern: 'COLUMNS',
      count: 12,
      gutterSize: 16,
      offset: 24,
      alignment: 'STRETCH',
      sectionSize: undefined,
    });
    expect(square.grids[0]).toMatchObject({ pattern: 'GRID', sectionSize: 8, count: undefined });
  });
});

describe('style extraction batching', () => {
  it('reports progress per batch of 200 styles', async () => {
    installFakeFigma({
      textStyles: Array.from({ length: 250 }, (_, i) => fakeTextStyle({ id: `t${i}` })),
    });
    const onProgress = vi.fn();
    const styles = await extractTextStyles(onProgress);
    expect(styles).toHaveLength(250);
    expect(onProgress.mock.calls).toEqual([
      [200, 250],
      [250, 250],
    ]);
  });
});
