/**
 * The acceptance tests of docs/designmd-exact-fidelity.md: a component set with a reordering
 * variant (a tool tip), an added layer, and same-named siblings that differ in count.
 */
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractComponents } from '../../src/plugin/extraction/components';
import { extractStructures } from '../../src/plugin/extraction/structures';
import { generateComponentsJson } from '../../src/plugin/generators/componentsJson';
import { transformComponents } from '../../src/plugin/transform/components';
import type { ComponentV1, ComponentsFileV1, Layer } from '../../src/shared/componentsSchema';
import { makeDesignSystem } from './fixtures';
import {
  componentSet,
  document,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
  type FakeNode,
} from './helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
const validate = new Ajv({ strict: false, allErrors: true }).compile(schema);

interface Placed {
  name: string;
  /** Offset from the variant root, and size. */
  x: number;
  y: number;
  width: number;
  height: number;
  type?: string;
  visible?: boolean;
  children?: Placed[];
}

/** Builds a node whose absolute transform is the variant's page position plus its own offset. */
function place(p: Placed, origin: { x: number; y: number }): FakeNode {
  return node(
    p.type ?? 'FRAME',
    p.name,
    {
      visible: p.visible ?? true,
      width: p.width,
      height: p.height,
      absoluteTransform: [
        [1, 0, origin.x + p.x],
        [0, 1, origin.y + p.y],
      ],
      fills: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 }, opacity: 1, visible: true }],
    },
    (p.children ?? []).map((c) => place(c, origin)),
  );
}

const tip = (position: string, children: Placed[]): Placed => ({
  name: position,
  x: 0,
  y: 0,
  width: 120,
  height: 60,
  children,
});
const pointer = (x: number, y: number): Placed => ({ name: 'pointer', x, y, width: 8, height: 8 });
const container = (x: number, y: number): Placed => ({
  name: 'Container',
  x,
  y,
  width: 100,
  height: 40,
});
/** A flag made of `vectors` layers all named Vector, each `each` px wide. */
const flag = (vectors: number, each = 5): Placed => ({
  name: 'Flag',
  x: 10,
  y: 10,
  width: 24,
  height: 16,
  children: Array.from({ length: vectors }, (_, i) => ({
    name: 'Vector',
    type: 'VECTOR',
    x: 10 + i * each,
    y: 10,
    width: each,
    height: 16,
  })),
});

/** Variants sit side by side on the page, like in a real component set. */
const VARIANTS: Array<{ name: string; tree: Placed }> = [
  // Default: pointer first.
  { name: 'Top', tree: tip('Top', [pointer(56, 0), container(10, 8), flag(2)]) },
  // Reordered: the pointer is drawn last.
  { name: 'Bottom', tree: tip('Bottom', [container(10, 0), pointer(56, 52), flag(2)]) },
  // Added layer, order otherwise unchanged.
  {
    name: 'WithBadge',
    tree: tip('WithBadge', [
      pointer(56, 0),
      container(10, 8),
      flag(2),
      { name: 'Badge', x: 100, y: 0, width: 12, height: 12 },
    ]),
  },
  // Same-named siblings that differ in number.
  { name: 'Flag3', tree: tip('Flag3', [pointer(56, 0), container(10, 8), flag(3, 4)]) },
  // A hidden layer: it keeps its box.
  {
    name: 'Hidden',
    tree: tip('Hidden', [pointer(56, 0), { ...container(10, 8), visible: false }, flag(2)]),
  },
];

async function exportTip() {
  const set = componentSet(
    'Tool tip',
    VARIANTS.map((v, i) => ({
      props: { Position: v.name },
      extra: {
        width: 120,
        height: 60,
        absoluteTransform: [
          [1, 0, 1000 * i + 50],
          [0, 1, 300],
        ],
      },
      children: v.tree.children!.map((c) => place(c, { x: 1000 * i + 50, y: 300 })),
    })),
    {
      componentPropertyDefinitions: {
        Position: {
          type: 'VARIANT',
          defaultValue: 'Top',
          variantOptions: VARIANTS.map((v) => v.name),
        },
      },
    },
  );
  installFakeFigma({ root: document('File', [page('Components', [set])]) });
  const base = makeDesignSystem();
  const ds = { ...base, components: transformComponents(await extractComponents()) };
  const structures = await extractStructures(ds.components);
  const file = JSON.parse(generateComponentsJson(ds, structures).content) as ComponentsFileV1;
  return { file, component: file.components[0] as ComponentV1 };
}

/** The variant's tree as the export describes it: the default tree with its diff applied to `box`. */
function boxesOf(component: ComponentV1, variantId: string): Map<string, Layer['box']> {
  const boxes = new Map<string, Layer['box']>();
  const diff = component.variantDiffs.find((d) => d.variantId === variantId);
  const walk = (layer: Layer, path: string) => {
    const changed = diff?.layers.find((l) => l.path === path)?.changes.box;
    boxes.set(path, changed ?? layer.box);
    const counts = new Map<string, number>();
    for (const c of layer.children) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
    const seen = new Map<string, number>();
    for (const c of layer.children) {
      const n = seen.get(c.name) ?? 0;
      seen.set(c.name, n + 1);
      walk(c, `${path}/${counts.get(c.name)! > 1 ? `${c.name}[${n}]` : c.name}`);
    }
  };
  walk(component.tree, component.tree.name);
  return boxes;
}

describe('exact fidelity: tool tip golden export', () => {
  it('validates against the published schema', async () => {
    const { file } = await exportTip();
    expect(validate(file), JSON.stringify(validate.errors?.slice(0, 3))).toBe(true);
  });

  it("gives every layer of the default variant a box equal to its transform minus the root's", async () => {
    const { component } = await exportTip();
    expect(component.tree.box).toEqual({ x: 0, y: 0, width: 120, height: 60 });
    const byName = Object.fromEntries(component.tree.children.map((c) => [c.name, c.box]));
    expect(byName.pointer).toEqual({ x: 56, y: 0, width: 8, height: 8 });
    expect(byName.Container).toEqual({ x: 10, y: 8, width: 100, height: 40 });
    expect(component.tree.children[2].children.map((c) => c.box)).toEqual([
      { x: 10, y: 10, width: 5, height: 16 },
      { x: 15, y: 10, width: 5, height: 16 },
    ]);
  });

  it("gives a variant's layers the box they have in that variant, through the diff", async () => {
    const { component } = await exportTip();
    const bottom = component.variants.find((v) => v.name.endsWith('Bottom'))!;
    const boxes = boxesOf(component, bottom.id);
    // Different from the default, and equal to where the variant really puts them.
    expect(boxes.get('Tool tip/pointer')).toEqual({ x: 56, y: 52, width: 8, height: 8 });
    expect(boxes.get('Tool tip/Container')).toEqual({ x: 10, y: 0, width: 100, height: 40 });
    // Not repeated for a layer that did not move.
    const diff = component.variantDiffs.find((d) => d.variantId === bottom.id)!;
    expect(diff.layers.map((l) => l.path)).not.toContain('Tool tip/Flag');
  });

  it('keeps the box of a hidden layer, so hidden can be told from missing', async () => {
    const { component } = await exportTip();
    const hidden = component.variants.find((v) => v.name.endsWith('Hidden'))!;
    const diff = component.variantDiffs.find((d) => d.variantId === hidden.id)!;
    const container = diff.layers.find((l) => l.path === 'Tool tip/Container')!;
    expect(container.changes.visible).toBe(false);
    // Its box is the same as in the default, so it is not repeated; the default tree has it.
    expect(boxesOf(component, hidden.id).get('Tool tip/Container')).toEqual({
      x: 10,
      y: 8,
      width: 100,
      height: 40,
    });
  });

  it('lists reordered children only for the variant that reorders them', async () => {
    const { component } = await exportTip();
    const reorderedBy = Object.fromEntries(
      component.variantDiffs.map((d) => [
        component.variants.find((v) => v.id === d.variantId)!.name,
        d.reordered,
      ]),
    );
    expect(reorderedBy['Position=Bottom']).toEqual([
      {
        parentPath: 'Tool tip',
        order: ['Tool tip/Container', 'Tool tip/pointer', 'Tool tip/Flag'],
      },
    ]);
    for (const name of ['Position=WithBadge', 'Position=Flag3', 'Position=Hidden']) {
      expect(reorderedBy[name]).toEqual([]);
    }
  });

  it('says where an added layer goes', async () => {
    const { component } = await exportTip();
    const diff = component.variantDiffs.find((d) =>
      component.variants.find((v) => v.id === d.variantId)!.name.endsWith('WithBadge'),
    )!;
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0]).toMatchObject({ parentPath: 'Tool tip', index: 3 });
    expect(diff.added[0].layer).toMatchObject({
      name: 'Badge',
      box: { x: 100, y: 0, width: 12, height: 12 },
    });
  });

  it('names the default layer each change is for, and warns where same-named siblings differ in count', async () => {
    const { file, component } = await exportTip();
    const flag3 = component.variants.find((v) => v.name.endsWith('Flag3'))!;
    const diff = component.variantDiffs.find((d) => d.variantId === flag3.id)!;
    const defaultFlag = component.tree.children.find((c) => c.name === 'Flag')!;
    for (const entry of diff.layers) expect(entry.layerId).toEqual(expect.any(String));
    expect(diff.layers.find((l) => l.path === 'Tool tip/Flag/Vector[1]')?.layerId).toBe(
      defaultFlag.children[1].id,
    );
    const ambiguous = file.warnings.filter((w) => w.code === 'AMBIGUOUS_SIBLINGS');
    expect(ambiguous).toHaveLength(1);
    expect(ambiguous[0]).toMatchObject({ variantId: flag3.id, componentId: component.id });
    expect(ambiguous[0].message).toContain('"Tool tip/Flag"');
  });

  it('writes metadata.fonts as an array even when no text is used', async () => {
    const { file } = await exportTip();
    expect(file.metadata.fonts).toEqual([]);
  });
});
