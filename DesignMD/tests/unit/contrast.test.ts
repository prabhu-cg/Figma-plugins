import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  relativeLuminance,
  MAX_REPORTED_PAIRS,
  colorModeNames,
  computeContrastReport,
  computeContrastReportsByMode,
  computeDefinedPairs,
  listColorTokenNames,
} from '../../src/plugin/generators/contrast';
import { generateDesignMd } from '../../src/plugin/generators/designMd';
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

describe('contrast role inference', () => {
  it('does not treat "button-*" names as foreground via a substring match on "on-"', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles.color = [
      { ...ds.styles.color[0], id: 's1', name: 'button-bg', cssName: '--button-bg' },
      { ...ds.styles.color[0], id: 's2', name: 'on-primary', cssName: '--on-primary' },
    ];
    const report = computeContrastReport(ds);
    expect(report.pairs).toHaveLength(1);
    expect(report.pairs[0].foreground.name).toBe('on-primary');
    expect(report.pairs[0].background.name).toBe('button-bg');
  });
});

describe('contrast pair cap', () => {
  it('keeps only the worst pairs for large cross products but reports exact totals', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    const style = ds.styles.color[0];
    const mk = (name: string, lightness: number) => ({
      ...style,
      id: name,
      name,
      cssName: `--${name}`,
      paint: { hex: '#000', r: lightness, g: lightness, b: lightness, a: 1 },
    });
    ds.styles.color = [
      ...Array.from({ length: 40 }, (_, i) => mk(`text-${i}`, i / 40)),
      ...Array.from({ length: 40 }, (_, i) => mk(`bg-${i}`, i / 40)),
    ];
    const report = computeContrastReport(ds);
    expect(report.totalPairs).toBe(40 * 40);
    expect(report.pairs.length).toBeLessThanOrEqual(MAX_REPORTED_PAIRS);
    expect(report.pairs.length).toBe(MAX_REPORTED_PAIRS);
    const ratios = report.pairs.map((p) => p.ratio);
    expect([...ratios].sort((a, b) => a - b)).toEqual(ratios);
    expect(report.failingLargeCount).toBeGreaterThan(0);
  });
});

describe('mode-aware contrast', () => {
  const color = (hex: string, v: number): ColorValue => ({ hex, r: v, g: v, b: v, a: 1 });

  function dsWithModes() {
    const ds = makeDesignSystem();
    ds.variables = [];
    const base = {
      collectionId: 'c',
      collectionName: 'Theme',
      resolvedType: 'COLOR' as const,
      category: 'color' as const,
      description: '',
      codeSyntax: {},
      usedByComponents: [],
    };
    ds.variables.push(
      {
        ...base,
        id: 'text',
        name: 'Text/Primary',
        path: ['Text', 'Primary'],
        cssName: '--text-primary',
        scopes: ['TEXT_FILL'],
        valuesByMode: [
          { modeId: 'l', modeName: 'Light', value: { kind: 'color', color: color('#111', 0.07) } },
          { modeId: 'd', modeName: 'Dark', value: { kind: 'color', color: color('#222', 0.13) } },
        ],
      },
      {
        ...base,
        id: 'bg',
        name: 'Surface/Page',
        path: ['Surface', 'Page'],
        cssName: '--surface-page',
        scopes: ['FRAME_FILL'],
        valuesByMode: [
          { modeId: 'l', modeName: 'Light', value: { kind: 'color', color: color('#fff', 1) } },
          { modeId: 'd', modeName: 'Dark', value: { kind: 'color', color: color('#000', 0) } },
        ],
      },
    );
    ds.styles.color = [];
    return ds;
  }

  it('lists the color modes in order of appearance', () => {
    expect(colorModeNames(dsWithModes())).toEqual(['Light', 'Dark']);
  });

  it('computes a separate report per mode, so a pair can pass in Light and fail in Dark', () => {
    const reports = computeContrastReportsByMode(dsWithModes());
    expect(reports.map((r) => r.modeName)).toEqual(['Light', 'Dark']);
    const [light, dark] = reports.map((r) => r.report.pairs[0]);
    expect(light.passesAANormal).toBe(true);
    expect(dark.passesAANormal).toBe(false);
    expect(dark.ratio).toBeLessThan(light.ratio);
  });

  it('follows aliases within the same mode and falls back to the default for missing modes', () => {
    const ds = dsWithModes();
    ds.variables.push({
      ...ds.variables[0],
      id: 'alias',
      name: 'Text/Link',
      path: ['Text', 'Link'],
      cssName: '--text-link',
      valuesByMode: [
        {
          modeId: 'x',
          modeName: 'Light',
          value: { kind: 'alias', variableId: 'text', variableName: 'Text/Primary' },
        },
      ],
    });
    const dark = computeContrastReport(ds, 'Dark');
    const link = dark.pairs.find((p) => p.foreground.name === 'Text/Link');
    // No Dark value on the alias itself, so its default (Light) value is used, which points at
    // Text/Primary resolved in Dark.
    expect(link?.foreground.color.hex).toBe('#222');
  });

  it('returns a single report when there is at most one color mode', () => {
    const ds = dsWithModes();
    ds.variables.forEach((v) => (v.valuesByMode = v.valuesByMode.slice(0, 1)));
    expect(computeContrastReportsByMode(ds)).toHaveLength(1);
  });

  it('renders one design.md subsection per mode', () => {
    const ds = dsWithModes();
    const { content } = generateDesignMd(ds);
    expect(content).toContain('Checked separately for each of the 2 color modes: Light, Dark.');
    expect(content).toContain('#### Mode: Light');
    expect(content).toContain('#### Mode: Dark');
  });
});

describe('defined contrast pairs', () => {
  const color = (hex: string, v: number, a = 1): ColorValue => ({ hex, r: v, g: v, b: v, a });
  function ds() {
    const system = makeDesignSystem();
    system.variables = [];
    system.styles.color = [
      { ...makeDesignSystem().styles.color[0], id: 'ink', name: 'Ink', paint: color('#000', 0) },
      {
        ...makeDesignSystem().styles.color[0],
        id: 'paper',
        name: 'Paper',
        paint: color('#fff', 1),
      },
      {
        ...makeDesignSystem().styles.color[0],
        id: 'grey',
        name: 'Grey',
        paint: color('#777', 0.47),
      },
      {
        ...makeDesignSystem().styles.color[0],
        id: 'ghost',
        name: 'Ghost',
        paint: color('#fff8', 1, 0.5),
      },
    ];
    return system;
  }

  it('lists color tokens usable in a pair, once each', () => {
    const system = makeDesignSystem();
    expect(listColorTokenNames(system)).toEqual([
      'Color/Primary/500',
      'Semantic/Color/Danger',
      'Surface/Background',
    ]);
  });

  it('computes ratio and AA results', () => {
    const [ok, weak] = computeDefinedPairs(ds(), [
      { foreground: 'Ink', background: 'Paper' },
      { foreground: 'Grey', background: 'Paper' },
    ]);
    expect(ok).toMatchObject({ status: 'ok', passesAANormal: true, passesAALarge: true });
    expect(ok.ratio).toBeCloseTo(21, 1);
    expect(weak.status).toBe('ok');
    expect(weak.passesAANormal).toBe(false);
  });

  it('reports missing and translucent tokens instead of dropping them', () => {
    const [missing, translucent] = computeDefinedPairs(ds(), [
      { foreground: 'Ink', background: 'Deleted' },
      { foreground: 'Ink', background: 'Ghost' },
    ]);
    expect(missing.status).toBe('missing');
    expect(translucent.status).toBe('translucent');
  });

  it('resolves variables in the requested mode', () => {
    const system = dsWithModesForPairs();
    const [light] = computeDefinedPairs(
      system,
      [{ foreground: 'Text/Primary', background: 'Surface/Page' }],
      'Light',
    );
    const [dark] = computeDefinedPairs(
      system,
      [{ foreground: 'Text/Primary', background: 'Surface/Page' }],
      'Dark',
    );
    expect(light.passesAANormal).toBe(true);
    expect(dark.passesAANormal).toBe(false);
  });

  function dsWithModesForPairs() {
    const system = makeDesignSystem();
    system.styles.color = [];
    const base = {
      collectionId: 'c',
      collectionName: 'T',
      resolvedType: 'COLOR' as const,
      category: 'color' as const,
      description: '',
      codeSyntax: {},
      usedByComponents: [],
      scopes: [] as string[],
    };
    system.variables = [
      {
        ...base,
        id: 't',
        name: 'Text/Primary',
        path: ['Text', 'Primary'],
        cssName: '--t',
        valuesByMode: [
          { modeId: 'l', modeName: 'Light', value: { kind: 'color', color: color('#111', 0.07) } },
          { modeId: 'd', modeName: 'Dark', value: { kind: 'color', color: color('#222', 0.13) } },
        ],
      },
      {
        ...base,
        id: 'b',
        name: 'Surface/Page',
        path: ['Surface', 'Page'],
        cssName: '--b',
        valuesByMode: [
          { modeId: 'l', modeName: 'Light', value: { kind: 'color', color: color('#fff', 1) } },
          { modeId: 'd', modeName: 'Dark', value: { kind: 'color', color: color('#000', 0) } },
        ],
      },
    ];
    return system;
  }

  it('renders a Defined Pairs table in design.md, per mode when there are several', () => {
    const system = dsWithModesForPairs();
    system.contrastPairs = [
      { foreground: 'Text/Primary', background: 'Surface/Page' },
      { foreground: 'Text/Primary', background: 'Gone' },
    ];
    const { content } = generateDesignMd(system);
    expect(content.match(/Defined Pairs/g)).toHaveLength(2);
    expect(content).toContain('Token not found');
    expect(content).toMatch(/\| Text\/Primary \| Surface\/Page \| [\d.]+:1 \| Pass \| Pass \|/);
    expect(content).toMatch(/\| Text\/Primary \| Surface\/Page \| [\d.]+:1 \| Fail \| Fail \|/);
  });

  it('adds nothing when no pairs are defined', () => {
    expect(generateDesignMd(makeDesignSystem()).content).not.toContain('Defined Pairs');
  });
});
