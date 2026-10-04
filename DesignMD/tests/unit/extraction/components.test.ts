import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractComponents } from '../../../src/plugin/extraction/components';
import {
  alias,
  component,
  componentSet,
  document,
  frame,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
} from '../helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const collect = () => {
  const list: string[] = [];
  return { list, warn: (m: string) => list.push(m) };
};

describe('extractComponents: discovery', () => {
  it('loads all pages first, then finds sets and standalone components across pages', async () => {
    const handle = installFakeFigma({
      root: document('File', [
        page('Buttons', [
          componentSet('Button', [{ props: { Size: 'Large' } }, { props: { Size: 'Small' } }]),
        ]),
        page('Icons', [frame('Group', [component('Icon/Home')])]),
      ]),
    });
    const result = await extractComponents();
    expect(handle.calls.loadAllPages).toBe(1);
    expect(result.map((c) => [c.name, c.isComponentSet, c.pageName])).toEqual([
      ['Button', true, 'Buttons'],
      ['Icon/Home', false, 'Icons'],
    ]);
  });

  it('does not report a set’s variant children as standalone components', async () => {
    installFakeFigma({
      root: document('File', [
        page('P', [
          componentSet('Button', [{ props: { State: 'Default' } }, { props: { State: 'Hover' } }]),
        ]),
      ]),
    });
    const result = await extractComponents();
    expect(result).toHaveLength(1);
    expect(result[0].variants.map((v) => v.name)).toEqual(['State=Default', 'State=Hover']);
  });

  it('uses the key when present and falls back to the id', async () => {
    const withKey = component('A', { key: 'abc' });
    const noKey = component('B', { key: undefined, id: 'B:id' });
    installFakeFigma({ root: document('File', [page('P', [withKey, noKey])]) });
    const result = await extractComponents();
    expect(result.map((c) => c.key)).toEqual(['abc', 'B:id']);
  });

  it('maps description, variant properties, and component property definitions', async () => {
    const set = componentSet(
      'Button',
      [{ props: { Size: 'Large' }, extra: { description: 'Big one' } }],
      {
        description: 'A button',
        componentPropertyDefinitions: {
          Label: { type: 'TEXT', defaultValue: 'Click me' },
          Disabled: { type: 'BOOLEAN', defaultValue: false },
          Size: { type: 'VARIANT', defaultValue: 'Large', variantOptions: ['Large', 'Small'] },
          Icon: { type: 'INSTANCE_SWAP', defaultValue: undefined },
        },
      },
    );
    installFakeFigma({ root: document('File', [page('P', [set])]) });
    const [c] = await extractComponents();
    expect(c.description).toBe('A button');
    expect(c.variants[0]).toMatchObject({
      description: 'Big one',
      variantProperties: { Size: 'Large' },
    });
    expect(c.properties).toEqual([
      { name: 'Label', type: 'TEXT', defaultValue: 'Click me', variantOptions: undefined },
      { name: 'Disabled', type: 'BOOLEAN', defaultValue: 'false', variantOptions: undefined },
      { name: 'Size', type: 'VARIANT', defaultValue: 'Large', variantOptions: ['Large', 'Small'] },
      { name: 'Icon', type: 'INSTANCE_SWAP', defaultValue: '', variantOptions: undefined },
    ]);
  });

  it('returns an empty list with a warning when the document scan throws', async () => {
    installFakeFigma({ failures: { findAll: true } });
    const { list, warn } = collect();
    expect(await extractComponents(undefined, warn)).toEqual([]);
    expect(list.some((m) => m.includes('Failed to scan document'))).toBe(true);
  });

  it('still scans (and warns) when loading all pages fails', async () => {
    installFakeFigma({
      root: document('File', [page('P', [component('A')])]),
      failures: { loadAllPages: true },
    });
    const { list, warn } = collect();
    const result = await extractComponents(undefined, warn);
    expect(result).toHaveLength(1);
    expect(list[0]).toContain('Failed to load all pages');
  });

  it('reports progress per stage (sets, then standalone components)', async () => {
    installFakeFigma({
      root: document('File', [
        page('P', [componentSet('S', [{ props: { A: '1' } }]), component('C1'), component('C2')]),
      ]),
    });
    const onProgress = vi.fn();
    await extractComponents(onProgress);
    expect(onProgress.mock.calls).toEqual([
      [1, 1],
      [2, 2],
    ]);
  });
});

describe('extractComponents: hidden from publishing', () => {
  it('skips components hidden by their own name, an ancestor frame, or their page', async () => {
    installFakeFigma({
      root: document('File', [
        page('Visible', [
          component('Shown'),
          component('.Hidden'),
          frame('.Drafts', [component('InHiddenFrame')]),
        ]),
        page('.Playground', [component('OnHiddenPage')]),
      ]),
    });
    const { list, warn } = collect();
    const result = await extractComponents(undefined, warn);
    expect(result.map((c) => c.name)).toEqual(['Shown']);
    expect(list.find((m) => m.includes('hidden from publishing'))).toContain('Skipped 3');
  });

  it('does not treat a file name starting with "." as hidden', async () => {
    installFakeFigma({ root: document('.dotfile', [page('P', [component('Shown')])]) });
    const result = await extractComponents();
    expect(result.map((c) => c.name)).toEqual(['Shown']);
  });
});

describe('extractComponents: bound variables and styles', () => {
  it('collects variables bound on the component and its descendants, deduplicated', async () => {
    const button = component('Button', { boundVariables: { fills: [alias('v-fill')] } }, [
      node('RECTANGLE', 'bg', { boundVariables: { cornerRadius: alias('v-radius') } }),
      frame('inner', [node('TEXT', 'label', { boundVariables: { fills: [alias('v-fill')] } })]),
    ]);
    installFakeFigma({ root: document('File', [page('P', [button])]) });
    const [c] = await extractComponents();
    expect(c.boundVariableIds.sort()).toEqual(['v-fill', 'v-radius']);
    expect(c.variants[0].boundVariableIds.sort()).toEqual(['v-fill', 'v-radius']);
  });

  it('unions variants’ bindings at the component-set level', async () => {
    const set = componentSet('Chip', [
      { props: { S: 'a' }, extra: { boundVariables: { fills: [alias('v1')] } } },
      { props: { S: 'b' }, extra: { boundVariables: { fills: [alias('v2')] } } },
    ]);
    installFakeFigma({ root: document('File', [page('P', [set])]) });
    const [c] = await extractComponents();
    expect(c.boundVariableIds.sort()).toEqual(['v1', 'v2']);
    expect(c.variants.map((v) => v.boundVariableIds)).toEqual([['v1'], ['v2']]);
  });

  it('records applied style ids, ignoring figma.mixed, empty ids, and throwing accessors', async () => {
    const mixed = Symbol('mixed');
    const throwing = node('VECTOR', 'v');
    Object.defineProperty(throwing, 'fillStyleId', {
      get() {
        throw new Error('not accessible');
      },
    });
    const button = component('Button', { fillStyleId: 'S:paint:1' }, [
      node('TEXT', 'label', { textStyleId: 'S:text:1', fillStyleId: mixed }),
      node('RECTANGLE', 'bg', { effectStyleId: '', strokeStyleId: 'S:paint:2' }),
      throwing,
    ]);
    installFakeFigma({ root: document('File', [page('P', [button])]) });
    const [c] = await extractComponents();
    expect([...(c.styleIds ?? [])].sort()).toEqual(['S:paint:1', 'S:paint:2', 'S:text:1']);
  });
});

describe('extractComponents: scan budget', () => {
  it('warns once when a component exceeds the layer budget, and still finishes', async () => {
    const wide = component(
      'Huge',
      {},
      Array.from({ length: 600 }, (_, i) =>
        node('RECTANGLE', `r${i}`, { boundVariables: { fills: [alias(`v${i}`)] } }),
      ),
    );
    installFakeFigma({ root: document('File', [page('P', [wide, component('Small')])]) });
    const { list, warn } = collect();
    const result = await extractComponents(undefined, warn);
    const huge = result.find((c) => c.name === 'Huge')!;

    // 1 component + 499 children scanned before the 500-node budget runs out.
    expect(huge.boundVariableIds).toHaveLength(499);
    const budgetWarnings = list.filter((m) => m.includes('scan budget'));
    expect(budgetWarnings).toHaveLength(1);
    expect(budgetWarnings[0]).toContain('1 component(s)');
  });

  it('warns when a component is nested deeper than the depth limit', async () => {
    let deepest = node('RECTANGLE', 'leaf', { boundVariables: { fills: [alias('v-deep')] } });
    for (let i = 0; i < 12; i++) deepest = frame(`level${i}`, [deepest]);
    installFakeFigma({ root: document('File', [page('P', [component('Deep', {}, [deepest])])]) });
    const { list, warn } = collect();
    const [c] = await extractComponents(undefined, warn);
    expect(c.boundVariableIds).not.toContain('v-deep');
    expect(list.some((m) => m.includes('scan budget'))).toBe(true);
  });

  it('does not warn for components within budget', async () => {
    installFakeFigma({
      root: document('File', [page('P', [component('Ok', {}, [node('TEXT', 't')])])]),
    });
    const { list, warn } = collect();
    await extractComponents(undefined, warn);
    expect(list).toEqual([]);
  });
});
