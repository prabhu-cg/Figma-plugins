import Ajv from 'ajv';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractComponentStructure,
  extractStructures,
} from '../../src/plugin/extraction/structures';
import { generateOutputs } from '../../src/plugin/generators';
import {
  buildComponentsFile,
  generateComponentsJson,
} from '../../src/plugin/generators/componentsJson';
import { findBrokenRefs } from '../../src/shared/componentsRefs';
import type { ComponentsFileV1 } from '../../src/shared/componentsSchema';
import { DEFAULT_EXPORT_OPTIONS } from '../../src/shared/messages';
import type { DesignSystem } from '../../src/shared/types';
import { transformComponents } from '../../src/plugin/transform/components';
import { extractComponents } from '../../src/plugin/extraction/components';
import {
  component,
  componentSet,
  document,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
} from './helpers/fakeFigma';
import { makeDesignSystem } from './fixtures';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const solid = (r: number, g: number, b: number, extra: object = {}) => ({
  type: 'SOLID',
  color: { r, g, b },
  opacity: 1,
  visible: true,
  ...extra,
});
const text = (name: string, props: object = {}) =>
  node('TEXT', name, {
    visible: true,
    width: 40,
    height: 20,
    characters: 'Label',
    fontName: { family: 'Inter', style: 'Regular' },
    fontWeight: 400,
    fontSize: 14,
    lineHeight: { unit: 'AUTO' },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textAlignHorizontal: 'LEFT',
    fills: [solid(0, 0, 0)],
    ...props,
  });
/** A Button set: default + hover (different fill, hidden icon), and a standalone Icon component. */
function buildFile() {
  const blue = solid(0, 0, 1, {
    boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'var:1' } },
  });
  const set = componentSet(
    'Button',
    [
      {
        props: { State: 'Default' },
        extra: { width: 100, height: 36, fills: [blue], cornerRadius: 8 },
        children: [text('Label', { componentPropertyReferences: { characters: 'label#1:0' } })],
      },
      {
        props: { State: 'Hover' },
        extra: { width: 100, height: 36, fills: [solid(0, 0, 0.5)], cornerRadius: 8 },
        children: [
          text('Label', { componentPropertyReferences: { characters: 'label#1:0' } }),
          text('Badge'),
        ],
      },
    ],
    {
      componentPropertyDefinitions: {
        State: { type: 'VARIANT', defaultValue: 'Default', variantOptions: ['Default', 'Hover'] },
        'label#1:0': { type: 'TEXT', defaultValue: 'Label' },
        'icon#2:0': {
          type: 'INSTANCE_SWAP',
          defaultValue: 'icon-1',
          preferredValues: [{ type: 'COMPONENT', key: 'k1' }],
        },
      },
    },
  );
  const icon = component('Icon/Arrow', { id: 'icon-1', width: 16, height: 16 });
  const p = page('Components', [set, icon]);
  return { root: document('File', [p]), set, icon };
}

async function dsFor(): Promise<DesignSystem> {
  const raw = await extractComponents();
  const base = makeDesignSystem();
  return { ...base, components: transformComponents(raw) };
}

const ajv = new Ajv({ strict: false, allErrors: true });
const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
const validate = ajv.compile(schema);

describe('extractComponentStructure', () => {
  it('reads the default tree, variant diffs, roles and property details', async () => {
    const { root, set } = buildFile();
    installFakeFigma({ root });
    const s = await extractComponentStructure(set as never, {
      resolveToken: (kind, id) =>
        kind === 'variable' && id === 'var:1' ? '--color-primary' : undefined,
    });

    expect(s.defaultVariantId).toBe(set.children![0].id);
    expect(s.tree.role).toBe('root');
    expect(s.tree.children[0]).toMatchObject({ role: 'label', roleSource: 'property' });
    expect(s.tree.fills?.[0].token).toEqual({ variableId: 'var:1', cssName: '--color-primary' });
    expect(s.usedVariableIds).toEqual(['var:1']);

    expect(s.variantDiffs).toHaveLength(1);
    expect(s.variantDiffs[0].variantProperties).toEqual({ State: 'Hover' });
    expect(s.variantDiffs[0].layers.map((l) => l.path)).toEqual(['Button']);
    expect(s.variantDiffs[0].added.map((a) => a.layer.name)).toEqual(['Badge']);
    expect(s.treeTruncated).toBe(false);

    const byKey = Object.fromEntries(s.properties.map((p) => [p.key, p]));
    expect(byKey['label#1:0']).toMatchObject({ name: 'label', type: 'TEXT' });
    expect(byKey['icon#2:0']).toMatchObject({
      name: 'icon',
      defaultResolved: { id: 'icon-1', name: 'Icon/Arrow' },
      preferredValues: [{ type: 'COMPONENT', key: 'k1' }],
    });
    expect(byKey.State.name).toBe('State');
  });

  it('skips diffs when asked, and when a set has too many variants', async () => {
    const { root, set } = buildFile();
    installFakeFigma({ root });
    const off = await extractComponentStructure(set as never, { includeVariantDiffs: false });
    expect(off.variantDiffs).toEqual([]);
    expect(off.warnings).toEqual([]);

    const many = componentSet(
      'Big',
      Array.from({ length: 130 }, (_, i) => ({ props: { N: String(i) } })),
    );
    installFakeFigma({ root: document('F', [page('P', [many])]) });
    const skipped = await extractComponentStructure(many as never);
    expect(skipped.variantDiffs).toEqual([]);
    expect(skipped.warnings.map((w) => w.code)).toContain('VARIANT_DIFFS_SKIPPED');
  });

  it('stops diffing when the time budget is spent, flagging truncation', async () => {
    const { root, set } = buildFile();
    installFakeFigma({ root });
    let t = 0;
    const s = await extractComponentStructure(set as never, {
      timeBudgetMs: 100,
      now: () => (t += 500),
    });
    expect(s.treeTruncated).toBe(true);
    expect(s.variantDiffs).toEqual([]);
    expect(s.warnings.map((w) => w.code)).toContain('TREE_TRUNCATED');
  });
});

describe('extractComponentStructure: budgets and hostile nodes', () => {
  it('stops adding variant diffs once their size passes the memory budget', async () => {
    const variants = Array.from({ length: 20 }, (_, i) => ({
      props: { N: String(i) },
      extra: { width: 100 + i, height: 36, fills: [solid(i / 20, 0, 0)] },
      children: [text('Label'), text('Extra')],
    }));
    const set = componentSet('Wide', variants);
    installFakeFigma({ root: document('F', [page('P', [set])]) });
    const s = await extractComponentStructure(set as never, { memoryBudgetBytes: 2000 });
    expect(s.variantDiffs.length).toBeGreaterThan(0);
    expect(s.variantDiffs.length).toBeLessThan(19);
    expect(s.treeTruncated).toBe(true);
    expect(
      s.warnings.some((w) => w.code === 'TREE_TRUNCATED' && w.message.includes('size budget')),
    ).toBe(true);
    const bytes = s.variantDiffs.reduce((sum, d) => sum + JSON.stringify(d).length, 0);
    expect(bytes).toBeLessThanOrEqual(2000);
  });

  it('keeps the layers when the property list throws, and says so', async () => {
    const set = componentSet('Odd', [{ props: { S: 'a' }, children: [text('Label')] }]);
    Object.defineProperty(set, 'componentPropertyDefinitions', {
      get() {
        throw new Error('getter exploded');
      },
    });
    installFakeFigma({ root: document('F', [page('P', [set])]) });
    const s = await extractComponentStructure(set as never);
    expect(s.properties).toEqual([]);
    expect(s.tree.children).toHaveLength(1);
    const w = s.warnings.find((x) => x.code === 'PROPERTIES_UNREADABLE')!;
    expect(w.message).toContain('getter exploded');
    expect(w.componentId).toBe(set.id);
  });

  it('survives a variant node whose property getters throw', async () => {
    const set = componentSet('Bad', [{ props: { S: 'a' } }, { props: { S: 'b' } }]);
    Object.defineProperty(set.children![1], 'fills', {
      get() {
        throw new Error('fills exploded');
      },
    });
    installFakeFigma({ root: document('F', [page('P', [set])]) });
    await expect(extractComponentStructure(set as never)).resolves.toMatchObject({
      treeTruncated: false,
    });
  });
});

describe('extractStructures: isolation', () => {
  it('reports a missing node and a throwing node, and still reads the others', async () => {
    const { root, set } = buildFile();
    const handle = installFakeFigma({ root });
    const real = handle.figma.getNodeByIdAsync as (id: string) => Promise<unknown>;
    handle.figma.getNodeByIdAsync = (id: string) =>
      id === 'boom' ? Promise.reject(new Error('lookup failed')) : real(id);
    const docs = [{ id: set.id }, { id: 'missing' }, { id: 'boom' }] as never;
    const out = await extractStructures(docs);
    expect('error' in out.get(set.id)!).toBe(false);
    expect(out.get('missing')).toEqual({ error: 'The component could not be found in the file.' });
    expect(out.get('boom')).toEqual({ error: 'lookup failed' });
  });
});

describe('generateComponentsJson', () => {
  async function generate(options: Record<string, unknown> = {}) {
    const { root } = buildFile();
    installFakeFigma({ root });
    const ds = await dsFor();
    ds.metadata.generatedAt = (options.generatedAt as string) ?? ds.metadata.generatedAt;
    // give the fixture's variable the id the fake fill is bound to
    ds.variables[0] = { ...ds.variables[0], id: 'var:1' };
    ds.components.forEach((c) => (c.boundVariableIds = []));
    const structures = await extractStructures(ds.components, {
      resolveToken: (kind, id) =>
        kind === 'variable' ? ds.variables.find((v) => v.id === id)?.cssName : undefined,
      ...(options.includeText === false ? { includeText: false } : {}),
    });
    return { ds, structures, file: generateComponentsJson(ds, structures) };
  }

  it('writes a valid, self-consistent file with tokens, index and a content hash', async () => {
    const { file } = await generate();
    expect(file.path).toBe('components.json');
    expect(file.content.endsWith('\n')).toBe(true);
    expect(file.content).not.toContain('\r');
    const json = JSON.parse(file.content) as ComponentsFileV1;

    expect(validate(json)).toBe(true);
    expect(validate.errors ?? []).toEqual([]);
    expect(findBrokenRefs(json, { checkInstances: false })).toEqual([]);

    expect(json.schema).toBe('designmd.components/v1');
    expect(json.index.componentCount).toBe(2);
    expect(json.index.components.map((c) => c.name)).toEqual(['Button', 'Icon/Arrow']);
    expect(json.tokens['var:1']).toMatchObject({ type: 'color' });
    expect(json.components[0].boundVariableIds).toEqual(['var:1']);

    const blank = file.content
      .replace(/"generatedAt": "[^"]*"/, '"generatedAt": ""')
      .replace(/"contentHash": "[^"]*"/, '"contentHash": ""');
    expect(json.metadata.contentHash).toBe(createHash('sha256').update(blank).digest('hex'));
  });

  it('is deterministic: the same input gives identical bytes', async () => {
    const a = await generate();
    resetFakeIds();
    const b = await generate({ generatedAt: a.ds.metadata.generatedAt });
    expect(a.file.content).toBe(b.file.content);
  });

  it('keys appear in schema order', async () => {
    const { file } = await generate();
    const json = JSON.parse(file.content);
    expect(Object.keys(json)).toEqual([
      '$schema',
      'schema',
      'metadata',
      'index',
      'tokens',
      'components',
      'warnings',
    ]);
    expect(Object.keys(json.components[0]).slice(0, 4)).toEqual([
      'id',
      'key',
      'name',
      'description',
    ]);
  });

  it('keeps a component whose structure failed, with an empty tree and a COMPONENT_FAILED warning', async () => {
    const { ds } = await generate();
    const file = buildComponentsFile(ds, new Map([[ds.components[0].id, { error: 'kaboom' }]]));
    const failed = file.components.find((c) => c.id === ds.components[0].id)!;
    expect(failed.treeTruncated).toBe(true);
    expect(failed.tree.children).toEqual([]);
    const w = file.warnings.filter((x) => x.code === 'COMPONENT_FAILED');
    expect(w.length).toBeGreaterThanOrEqual(1);
    expect(w[0].message).toContain('kaboom');
    expect(validate({ ...file, metadata: { ...file.metadata } })).toBe(true);
  });

  it('drops a token reference it cannot resolve and warns, rather than writing a dangling id', async () => {
    const { ds, structures } = await generate();
    ds.components[0].boundVariableIds = ['VariableID:hidden'];
    const file = buildComponentsFile(ds, structures);
    expect(file.components.flatMap((c) => c.boundVariableIds)).not.toContain('VariableID:hidden');
    expect(file.warnings.some((w) => w.code === 'UNRESOLVED_REFERENCE')).toBe(true);
    expect(findBrokenRefs(file, { checkInstances: false })).toEqual([]);
  });

  it('can leave out text content', async () => {
    const { file } = await generate({ includeText: false });
    const json = JSON.parse(file.content) as ComponentsFileV1;
    const texts: unknown[] = [];
    const walk = (l: ComponentsFileV1['components'][0]['tree']) => {
      if (l.text) texts.push(l.text.characters);
      l.children.forEach(walk);
    };
    json.components.forEach((c) => walk(c.tree));
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.every((t) => t === undefined)).toBe(true);
  });

  it('is only produced when selected', async () => {
    const { ds, structures } = await generate();
    const off = generateOutputs(ds, DEFAULT_EXPORT_OPTIONS, { structures }).map((f) => f.path);
    expect(off).not.toContain('components.json');
    const on = generateOutputs(
      ds,
      { ...DEFAULT_EXPORT_OPTIONS, componentsJson: true },
      { structures },
    );
    expect(on.map((f) => f.path)).toContain('components.json');
  });
});
