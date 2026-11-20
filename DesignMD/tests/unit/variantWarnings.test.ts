/** Warnings from reading the variants of a set: grouped per component, and not lost for variants. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractComponents } from '../../src/plugin/extraction/components';
import { extractStructures } from '../../src/plugin/extraction/structures';
import { transformComponents } from '../../src/plugin/transform/components';
import {
  componentSet,
  document,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
} from './helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const solid = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true }];
const angular = {
  type: 'GRADIENT_ANGULAR',
  visible: true,
  opacity: 1,
  gradientStops: [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 1 } },
  ],
  gradientTransform: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};
const vectors = (n: number, fills = solid) =>
  Array.from({ length: n }, () =>
    node('VECTOR', 'Vector', { width: 5, height: 16, fills, visible: true }),
  );
const flag = (n: number, fills = solid) => [
  node('FRAME', 'Flag', { width: 24, height: 16, fills: solid, visible: true }, vectors(n, fills)),
];

async function read(variants: Array<{ name: string; children: ReturnType<typeof flag> }>) {
  const set = componentSet(
    'Badge',
    variants.map((v) => ({
      props: { Kind: v.name },
      extra: { width: 40, height: 20 },
      children: v.children,
    })),
    {
      componentPropertyDefinitions: {
        Kind: {
          type: 'VARIANT',
          defaultValue: variants[0].name,
          variantOptions: variants.map((v) => v.name),
        },
      },
    },
  );
  installFakeFigma({ root: document('File', [page('Components', [set])]) });
  const docs = transformComponents(await extractComponents());
  const structures = await extractStructures(docs);
  const result = structures.get(docs[0].id)!;
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('warnings from the variants of a set', () => {
  it('writes AMBIGUOUS_SIBLINGS once per component, however many variants differ', async () => {
    const result = await read([
      { name: 'A', children: flag(2) },
      { name: 'B', children: flag(3) },
      { name: 'C', children: flag(4) },
      { name: 'D', children: flag(3) },
    ]);
    const ambiguous = result.warnings.filter((w) => w.code === 'AMBIGUOUS_SIBLINGS');
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0].message).toContain('1 parent layer');
    expect(ambiguous[0].message).toContain('"Vector"');
  });

  it('keeps an unsupported-gradient warning that only a variant raises, once', async () => {
    const result = await read([
      { name: 'A', children: flag(1) },
      { name: 'B', children: flag(1, [angular] as unknown as typeof solid) },
      { name: 'C', children: flag(1, [angular] as unknown as typeof solid) },
    ]);
    const gradient = result.warnings.filter((w) => w.code === 'UNSUPPORTED_GRADIENT');
    expect(gradient).toHaveLength(1);
    expect(gradient[0].message).toContain('angular');
  });
});
