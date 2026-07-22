import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  relativeLuminance,
  computeContrastReport,
} from '../../src/plugin/generators/contrast';
import { makeDesignSystem } from './fixtures';
import type { ColorValue } from '../../src/shared/types';

const WHITE: ColorValue = { hex: '#ffffff', r: 1, g: 1, b: 1, a: 1 };
const BLACK: ColorValue = { hex: '#000000', r: 0, g: 0, b: 0, a: 1 };

describe('relativeLuminance', () => {
  it('is 1 for white and 0 for black', () => {
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 5);
    expect(relativeLuminance(BLACK)).toBeCloseTo(0, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21:1 for black on white, the WCAG maximum', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 1);
  });

  it('is 1:1 for identical colors', () => {
    const color: ColorValue = { hex: '#808080', r: 0.5, g: 0.5, b: 0.5, a: 1 };
    expect(contrastRatio(color, color)).toBeCloseTo(1, 5);
  });

  it('is symmetric regardless of argument order', () => {
    const a: ColorValue = { hex: '#ff0000', r: 1, g: 0, b: 0, a: 1 };
    const b: ColorValue = { hex: '#0000ff', r: 0, g: 0, b: 1, a: 1 };
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 10);
  });
});

describe('computeContrastReport', () => {
  it('never throws on a fully empty design system', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles = { text: [], color: [], effect: [], grid: [] };
    expect(() => computeContrastReport(ds)).not.toThrow();
    const report = computeContrastReport(ds);
    expect(report.totalColorTokensChecked).toBe(0);
    expect(report.pairs).toEqual([]);
    expect(report.fallbackChecks).toEqual([]);
  });

  it('falls back to white/black checks when no foreground/background roles can be inferred', () => {
    // Fixture has "Color/Primary/500" (unknown role) and "Surface/Background" paint style
    // (background role, from the "surface"/"background" name hints) but nothing classified
    // as foreground, so pairing can't happen and it should fall back.
    const report = computeContrastReport(makeDesignSystem());
    expect(report.pairs).toEqual([]);
    expect(report.fallbackChecks.length).toBeGreaterThan(0);
    expect(report.fallbackChecks.some((c) => c.token.name === 'Color/Primary/500')).toBe(true);
  });

  it('builds foreground x background pairs when both roles are inferable', () => {
    const ds = makeDesignSystem();
    // Add a clear foreground (text) and background (surface) color variable.
    ds.variables.push(
      {
        id: 'var:text',
        name: 'Text/Primary',
        path: ['Text', 'Primary'],
        collectionId: 'collection:1',
        collectionName: 'Colors',
        resolvedType: 'COLOR',
        category: 'color',
        description: '',
        scopes: ['TEXT_FILL'],
        valuesByMode: [
          { modeId: 'mode:light', modeName: 'Light', value: { kind: 'color', color: BLACK } },
        ],
        codeSyntax: {},
        cssName: '--text-primary',
        usedByComponents: [],
      },
      {
        id: 'var:bg',
        name: 'Background/Surface',
        path: ['Background', 'Surface'],
        collectionId: 'collection:1',
        collectionName: 'Colors',
        resolvedType: 'COLOR',
        category: 'color',
        description: '',
        scopes: ['FRAME_FILL'],
        valuesByMode: [
          { modeId: 'mode:light', modeName: 'Light', value: { kind: 'color', color: WHITE } },
        ],
        codeSyntax: {},
        cssName: '--background-surface',
        usedByComponents: [],
      },
    );

    const report = computeContrastReport(ds);
    expect(report.fallbackChecks).toEqual([]);
    expect(report.pairs.length).toBeGreaterThan(0);
    const pair = report.pairs.find(
      (p) => p.foreground.name === 'Text/Primary' && p.background.name === 'Background/Surface',
    );
    expect(pair).toBeDefined();
    expect(pair!.ratio).toBeCloseTo(21, 1);
    expect(pair!.passesAANormal).toBe(true);
    expect(pair!.passesAALarge).toBe(true);
  });

  it('resolves alias variables to their underlying concrete color', () => {
    const report = computeContrastReport(makeDesignSystem());
    const semantic = [...report.fallbackChecks].find(
      (c) => c.token.name === 'Semantic/Color/Danger',
    );
    const primary = report.fallbackChecks.find((c) => c.token.name === 'Color/Primary/500');
    expect(semantic).toBeDefined();
    expect(primary).toBeDefined();
    // The alias resolves to the same color as the variable it points to, so ratios match.
    expect(semantic!.ratioOnWhite).toBeCloseTo(primary!.ratioOnWhite, 5);
  });

  it('skips translucent color tokens and reports the count', () => {
    const ds = makeDesignSystem();
    ds.variables.push({
      id: 'var:translucent',
      name: 'Color/Overlay',
      path: ['Color', 'Overlay'],
      collectionId: 'collection:1',
      collectionName: 'Colors',
      resolvedType: 'COLOR',
      category: 'color',
      description: '',
      scopes: [],
      valuesByMode: [
        {
          modeId: 'mode:light',
          modeName: 'Light',
          value: { kind: 'color', color: { hex: '#00000080', r: 0, g: 0, b: 0, a: 0.5 } },
        },
      ],
      codeSyntax: {},
      cssName: '--color-overlay',
      usedByComponents: [],
    });

    const report = computeContrastReport(ds);
    expect(report.skippedTranslucentCount).toBe(1);
    expect(report.fallbackChecks.some((c) => c.token.name === 'Color/Overlay')).toBe(false);
  });
});
