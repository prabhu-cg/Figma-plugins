import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractDesignSystem } from '../../../src/plugin/extraction';
import { transformToDesignSystem } from '../../../src/plugin/transform';
import { generateOutputs } from '../../../src/plugin/generators';
import { DEFAULT_EXPORT_OPTIONS } from '../../../src/shared/messages';
import {
  alias,
  component,
  componentSet,
  document,
  fakeCollection,
  fakeEffectStyle,
  fakeGridStyle,
  fakePaintStyle,
  fakeTextStyle,
  fakeVariable,
  installFakeFigma,
  node,
  page,
} from '../helpers/fakeFigma';

afterEach(() => vi.unstubAllGlobals());

function installRealisticFile() {
  return installFakeFigma({
    root: document('Acme Design System', [
      page('Buttons', [
        componentSet(
          'Button',
          [
            {
              props: { Size: 'Large', State: 'Default' },
              children: [
                node('RECTANGLE', 'bg', { boundVariables: { fills: [alias('v-primary')] } }),
                node('TEXT', 'label', { textStyleId: 'S:text:1' }),
              ],
            },
            { props: { Size: 'Small', State: 'Hover' } },
          ],
          { description: 'Primary action' },
        ),
      ]),
      page('.Scratch', [component('Hidden')]),
    ]),
    collections: [fakeCollection({ variableIds: ['v-primary', 'v-danger', 'v-spacing'] })],
    variables: [
      fakeVariable({ id: 'v-primary', name: 'Color/Primary/500', scopes: ['ALL_FILLS'] }),
      fakeVariable({
        id: 'v-danger',
        name: 'Semantic/Color/Danger',
        valuesByMode: { 'm:light': alias('v-primary') },
      }),
      fakeVariable({
        id: 'v-spacing',
        name: 'Spacing/md',
        resolvedType: 'FLOAT',
        valuesByMode: { 'm:light': 16 },
      }),
    ],
    textStyles: [fakeTextStyle({ boundVariables: { fontSize: alias('v-spacing') } })],
    paintStyles: [fakePaintStyle()],
    effectStyles: [fakeEffectStyle()],
    gridStyles: [fakeGridStyle()],
  });
}

describe('extractDesignSystem', () => {
  it('runs every extractor and returns the combined raw result', async () => {
    installRealisticFile();
    const result = await extractDesignSystem();
    expect(result.collections).toHaveLength(1);
    expect(result.variables.map((v) => v.id)).toEqual(['v-primary', 'v-danger', 'v-spacing']);
    expect(result.textStyles).toHaveLength(1);
    expect(result.paintStyles).toHaveLength(1);
    expect(result.effectStyles).toHaveLength(1);
    expect(result.gridStyles).toHaveLength(1);
    expect(result.components.map((c) => c.name)).toEqual(['Button']);
    expect(result.warnings.some((w) => w.includes('hidden from publishing'))).toBe(true);
  });

  it('reports progress for each stage in order', async () => {
    installRealisticFile();
    const stages: string[] = [];
    await extractDesignSystem((p) => {
      if (stages[stages.length - 1] !== p.stage) stages.push(p.stage);
    });
    expect(stages).toEqual([
      'variables',
      'text-styles',
      'color-styles',
      'effect-styles',
      'grid-styles',
      'components',
    ]);
  });

  it('warns when the file has no variables and no components', async () => {
    installFakeFigma({ root: document('Empty', [page('P')]) });
    const { warnings } = await extractDesignSystem();
    expect(warnings).toContain(
      'No local variables found — falling back to styles as the token source of truth.',
    );
    expect(warnings).toContain('No components or component sets found in this file.');
  });

  it('isolates failures: a broken stage warns but the others still extract', async () => {
    installFakeFigma({
      root: document('File', [page('P', [component('Button')])]),
      paintStyles: [fakePaintStyle()],
      failures: { collections: true, textStyles: true, effectStyles: true, gridStyles: true },
    });
    const result = await extractDesignSystem();
    expect(result.paintStyles).toHaveLength(1);
    expect(result.components).toHaveLength(1);
    expect(result.warnings.filter((w) => w.startsWith('Failed to load'))).toHaveLength(4);
  });
});

describe('extraction -> transform -> generators (full pipeline)', () => {
  async function run() {
    installRealisticFile();
    const raw = await extractDesignSystem();
    const ds = transformToDesignSystem(raw, 'Acme Design System');
    return { raw, ds };
  }

  it('produces a design system whose usage reflects direct and style-based bindings', async () => {
    const { ds } = await run();
    const byName = (name: string) => ds.variables.find((v) => v.name === name)!;
    // Bound directly on a layer inside the Button.
    expect(byName('Color/Primary/500').usedByComponents).toEqual(['Button']);
    // Bound only inside a text style that the Button's label applies.
    expect(byName('Spacing/md').usedByComponents).toEqual(['Button']);
    expect(byName('Semantic/Color/Danger').usedByComponents).toEqual([]);
    expect(ds.metadata.fileName).toBe('Acme Design System');
    expect(ds.summary).toMatchObject({
      variablesCount: 3,
      componentsCount: 2,
      componentSetsCount: 1,
    });
  });

  it('generates every output file from the extracted data', async () => {
    const { ds } = await run();
    const files = generateOutputs(ds, {
      ...DEFAULT_EXPORT_OPTIONS,
      tokensJson: true,
      cssTokensJson: true,
    });
    expect(files.map((f) => f.path)).toEqual([
      'design.md',
      'components/Button.md',
      'tokens.json',
      'css-tokens.json',
    ]);

    const tokens = JSON.parse(files.find((f) => f.path === 'tokens.json')!.content);
    expect(tokens.color.Primary['500'].$value).toBe('#ff0000');
    expect(tokens.semantic.Color.Danger.$value).toBe('{color.Primary.500}');
    expect(tokens.spacing.md.$value).toBe('16px');

    const css = JSON.parse(files.find((f) => f.path === 'css-tokens.json')!.content);
    expect(css.root['--color-primary-500']).toBe('#ff0000');
    expect(css.root['--semantic-color-danger']).toBe('var(--color-primary-500)');

    const designMd = files.find((f) => f.path === 'design.md')!.content;
    expect(designMd).toContain('](./components/Button.md)');
  });
});
