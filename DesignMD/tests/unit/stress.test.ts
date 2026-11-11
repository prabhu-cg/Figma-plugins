import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractComponents } from '../../src/plugin/extraction/components';
import { extractStructures } from '../../src/plugin/extraction/structures';
import { generateComponentsJson } from '../../src/plugin/generators/componentsJson';
import { transformComponents } from '../../src/plugin/transform/components';
import type { ComponentsFileV1 } from '../../src/shared/componentsSchema';
import {
  component,
  componentSet,
  document,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
  type FakeNode,
} from './helpers/fakeFigma';
import { makeDesignSystem } from './fixtures';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

/** Limits the whole-file scan must stay inside. Generous on purpose: they catch blow-ups, not slowdowns. */
const TIME_LIMIT_MS = 30_000;
const HEAP_GROWTH_LIMIT_BYTES = 600 * 1024 * 1024;

/** Every layer has an absolute transform, like a real node, so `box` is written and measured. */
const placed = (x: number, y: number) => ({
  absoluteTransform: [
    [1, 0, x],
    [0, 1, y],
  ],
});

const leaf = (i: number, props: object = {}) =>
  node('RECTANGLE', `Rect ${i}`, {
    visible: true,
    width: 10,
    height: 10,
    ...placed(i * 10, 20),
    fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true }],
    ...props,
  });

/** A chain of frames `depth` deep with `width` leaves at the bottom. */
function nested(depth: number, width: number, seed: number, props: object = {}): FakeNode {
  let inner: FakeNode[] = Array.from({ length: width }, (_, i) => leaf(i));
  for (let d = depth; d > 0; d--) {
    inner = [
      node(
        'FRAME',
        `Level ${d}`,
        { visible: true, width: 100, height: 100, ...placed(d, d) },
        inner,
      ),
    ];
  }
  return node(
    'FRAME',
    `Root ${seed}`,
    { visible: true, width: 200, height: 200, ...placed(0, 0), ...props },
    inner,
  );
}

function buildSyntheticFile() {
  const sets = Array.from({ length: 40 }, (_, s) =>
    componentSet(
      `Set ${s}`,
      Array.from({ length: 100 }, (_, v) => ({
        props: { Variant: String(v) },
        extra: { width: 100 + v, height: 40, ...placed(v * 500, s * 100) },
        children: [nested(3, 5, v, { opacity: 1 - v / 200 })],
      })),
    ),
  );
  const standalone = Array.from({ length: 960 }, (_, i) =>
    component(
      `Standalone ${i}`,
      placed(i * 400, 5000),
      // every 100th is deeper than the depth budget; every 250th is wider than the layer budget
      [nested(i % 100 === 0 ? 20 : 4, i % 250 === 0 ? 2100 : 6, i)],
    ),
  );
  return document('Synthetic', [page('Sets', sets), page('Standalone', standalone)]);
}

describe('whole-file scan of a synthetic 1,000-component file', () => {
  it('finishes inside the time and memory limits, with every component present and valid', async () => {
    installFakeFigma({ root: buildSyntheticFile() });
    const heapBefore = process.memoryUsage().heapUsed;
    const started = Date.now();

    const raw = await extractComponents();
    const docs = transformComponents(raw);
    const ds = { ...makeDesignSystem(), components: docs };
    const structures = await extractStructures(docs);
    const file = generateComponentsJson(ds, structures);

    const elapsed = Date.now() - started;
    const heapGrowth = process.memoryUsage().heapUsed - heapBefore;
    console.log(
      `synthetic 1,000 components: ${elapsed} ms, heap +${Math.round(heapGrowth / 1048576)} MB, output ${(file.content.length / 1048576).toFixed(1)} MB`,
    );
    expect(elapsed).toBeLessThan(TIME_LIMIT_MS);
    expect(heapGrowth).toBeLessThan(HEAP_GROWTH_LIMIT_BYTES);

    expect(docs).toHaveLength(1000);
    const json = JSON.parse(file.content) as ComponentsFileV1;
    expect(json.components).toHaveLength(1000);
    expect(json.index.componentCount).toBe(1000);

    // Sets keep their 99 diffs; over-budget components are flagged, never dropped or fatal.
    const set0 = json.components.find((c) => c.name === 'Set 0')!;
    expect(set0.variantDiffs).toHaveLength(99);
    const truncated = json.components.filter((c) => c.treeTruncated);
    expect(truncated.length).toBeGreaterThan(0);
    const truncatedIds = new Set(
      json.warnings.filter((w) => w.code === 'TREE_TRUNCATED').map((w) => w.componentId),
    );
    expect(truncated.every((c) => truncatedIds.has(c.id))).toBe(true);
    expect(json.warnings.filter((w) => w.code === 'COMPONENT_FAILED')).toEqual([]);

    const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
    const validate = new Ajv({ strict: false }).compile(schema);
    expect(validate(json)).toBe(true);
  }, 120_000);
});

describe('partial results under failure', () => {
  it('gives a result with warnings when some components fail, throw or cannot be found', async () => {
    const fine = component('Fine', {}, [nested(2, 3, 1)]);
    const hostile = component('Hostile', {}, [nested(2, 3, 2)]);
    const root = document('F', [page('P', [fine, hostile])]);
    const handle = installFakeFigma({ root });
    const docs = transformComponents(await extractComponents());
    expect(docs.map((d) => d.name).sort()).toEqual(['Fine', 'Hostile']);

    // The scan found it; now its layers become unreadable.
    Object.defineProperty(hostile, 'children', {
      get() {
        throw new Error('children getter exploded');
      },
    });

    const real = handle.figma.getNodeByIdAsync as (id: string) => Promise<unknown>;
    handle.figma.getNodeByIdAsync = (id: string) =>
      id === hostile.id ? Promise.reject(new Error('lookup exploded')) : real(id);

    const ds = {
      ...makeDesignSystem(),
      components: [...docs, { ...docs[0], id: 'gone', name: 'Gone' }],
    };
    const file = JSON.parse(
      generateComponentsJson(ds, await extractStructures(ds.components)).content,
    ) as ComponentsFileV1;

    expect(file.components).toHaveLength(3);
    const failed = file.warnings
      .filter((w) => w.code === 'COMPONENT_FAILED')
      .map((w) => w.componentId);
    expect(failed.sort()).toEqual([hostile.id, 'gone'].sort());
    expect(file.components.find((c) => c.name === 'Fine')!.tree.children.length).toBeGreaterThan(0);
  });

  it('returns the structures read so far when progress is reported per batch', async () => {
    const root = document('F', [
      page(
        'P',
        Array.from({ length: 25 }, (_, i) => component(`C${i}`)),
      ),
    ]);
    installFakeFigma({ root });
    const docs = transformComponents(await extractComponents());
    const seen: number[] = [];
    const out = await extractStructures(docs, {}, (done) => seen.push(done));
    expect(out.size).toBe(25);
    expect(seen.at(-1)).toBe(25);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});
