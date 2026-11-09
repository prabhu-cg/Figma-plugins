import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { newReadStats, readLayerTree } from '../../src/plugin/extraction/layers';

const MIXED = Symbol('figma.mixed');
const solid = (r: number, g: number, b: number, extra: object = {}) => ({
  type: 'SOLID',
  color: { r, g, b },
  opacity: 1,
  visible: true,
  ...extra,
});
const textNode = (over: object = {}) => ({
  id: 't1',
  type: 'TEXT',
  name: 'Label',
  visible: true,
  width: 37,
  height: 20,
  characters: 'Learn more',
  fontName: { family: 'Inter', style: 'Semi Bold' },
  fontWeight: 600,
  fontSize: 14,
  lineHeight: { unit: 'PIXELS', value: 20 },
  letterSpacing: { unit: 'PERCENT', value: 0 },
  textCase: 'ORIGINAL',
  textDecoration: 'NONE',
  textAlignHorizontal: 'LEFT',
  fills: [solid(0, 0, 0)],
  ...over,
});
const frame = (children: unknown[] = [], over: object = {}) => ({
  id: 'f1',
  type: 'FRAME',
  name: 'Button',
  visible: true,
  width: 124,
  height: 36,
  layoutMode: 'HORIZONTAL',
  itemSpacing: 10,
  paddingTop: 8,
  paddingRight: 16,
  paddingBottom: 8,
  paddingLeft: 16,
  primaryAxisAlignItems: 'CENTER',
  counterAxisAlignItems: 'CENTER',
  layoutSizingHorizontal: 'HUG',
  layoutSizingVertical: 'HUG',
  layoutWrap: 'NO_WRAP',
  cornerRadius: 8,
  opacity: 1,
  fills: [solid(0.0706, 0.3216, 0.9686)],
  strokes: [],
  strokeWeight: 0,
  strokeAlign: 'INSIDE',
  effects: [],
  children,
  ...over,
});

describe('readLayerTree', () => {
  it('reads geometry, auto layout, radius, fills, strokes and effects as plain values', async () => {
    const { tree } = await readLayerTree(frame([textNode()]));
    expect(tree).toMatchObject({
      id: 'f1',
      name: 'Button',
      type: 'FRAME',
      visible: true,
      size: { width: 124, height: 36 },
      radius: 8,
      opacity: 1,
      layout: {
        mode: 'HORIZONTAL',
        gap: 10,
        padding: { top: 8, right: 16, bottom: 8, left: 16 },
        primaryAlign: 'CENTER',
        counterAlign: 'CENTER',
        sizingH: 'HUG',
        sizingV: 'HUG',
        wrap: false,
      },
      fills: [{ type: 'SOLID', visible: true, hex: '#1252f7', alpha: 1 }],
      strokes: { paints: [], weight: 0, align: 'INSIDE' },
      effects: [],
    });
    expect(tree.children).toHaveLength(1);
  });

  it('writes layout only for auto-layout frames, and text only for text nodes', async () => {
    const { tree } = await readLayerTree(frame([], { layoutMode: 'NONE' }));
    expect(tree.layout).toBeUndefined();
    expect(tree.text).toBeUndefined();
    const text = (await readLayerTree(textNode())).tree;
    expect(text.text).toMatchObject({
      characters: 'Learn more',
      fontFamily: 'Inter',
      fontWeight: 600,
      fontSize: 14,
      lineHeight: { value: 20, unit: 'px' },
      letterSpacing: { value: 0, unit: 'percent' },
      align: 'LEFT',
    });
  });

  it('omits text characters when text content is off', async () => {
    const { tree } = await readLayerTree(textNode(), { includeText: false });
    expect(tree.text?.characters).toBeUndefined();
    expect(tree.text?.fontFamily).toBe('Inter');
  });

  it('reports uniform, mixed and zero corner radii', async () => {
    const mixed = frame([], {
      cornerRadius: MIXED,
      topLeftRadius: 8,
      topRightRadius: 8,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
    });
    expect((await readLayerTree(mixed)).tree.radius).toEqual({ tl: 8, tr: 8, br: 0, bl: 0 });
    const sameCorners = frame([], {
      cornerRadius: MIXED,
      topLeftRadius: 4,
      topRightRadius: 4,
      bottomRightRadius: 4,
      bottomLeftRadius: 4,
    });
    expect((await readLayerTree(sameCorners)).tree.radius).toBe(4);
    expect((await readLayerTree(frame([], { cornerRadius: 0 }))).tree.radius).toBeUndefined();
  });

  it('keeps hidden layers and marks them invisible', async () => {
    const { tree } = await readLayerTree(frame([textNode({ visible: false })]));
    expect(tree.children[0].visible).toBe(false);
  });

  it('never leaks figma.mixed: mixed text becomes runs', async () => {
    const mixed = textNode({
      fontName: MIXED,
      fontWeight: MIXED,
      fontSize: MIXED,
      getStyledTextSegments: () => [
        {
          characters: 'Hello ',
          fontName: { family: 'Inter', style: 'Regular' },
          fontWeight: 400,
          fontSize: 14,
          lineHeight: { unit: 'AUTO' },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          textCase: 'ORIGINAL',
          textDecoration: 'NONE',
          textStyleId: '',
        },
        {
          characters: 'world',
          fontName: { family: 'Inter', style: 'Bold' },
          fontWeight: 700,
          fontSize: 14,
          lineHeight: { unit: 'AUTO' },
          letterSpacing: { unit: 'PIXELS', value: 0 },
          textCase: 'ORIGINAL',
          textDecoration: 'UNDERLINE',
          textStyleId: '',
        },
      ],
    });
    const { tree } = await readLayerTree(mixed);
    expect(tree.text?.mixed).toBe(true);
    expect(tree.text?.runs).toHaveLength(2);
    expect(tree.text?.runs?.[1]).toMatchObject({
      characters: 'world',
      fontWeight: 700,
      textDecoration: 'UNDERLINE',
    });
    expect(tree.text?.lineHeight).toEqual({ value: 0, unit: 'auto' });
    expect(JSON.stringify(tree)).not.toContain('Symbol');
  });

  it('survives a node whose property getters throw', async () => {
    const hostile = {
      id: 'x',
      type: 'FRAME',
      get name(): string {
        throw new Error('boom');
      },
      get fills(): unknown {
        throw new Error('boom');
      },
      children: [],
    };
    const { tree } = await readLayerTree(hostile);
    expect(tree).toMatchObject({ id: 'x', name: '', visible: true });
    expect(tree.fills).toBeUndefined();
  });

  it('describes gradient and image paints without exporting image data', async () => {
    const node = frame([], {
      fills: [
        { type: 'GRADIENT_LINEAR', gradientStops: [{}, {}], visible: true },
        { type: 'IMAGE', imageHash: 'abc', scaleMode: 'FILL', visible: true },
      ],
    });
    const { tree } = await readLayerTree(node);
    expect(tree.fills).toEqual([
      { type: 'GRADIENT_LINEAR', visible: true, description: 'linear gradient, 2 stops' },
      { type: 'IMAGE', visible: true, description: 'image, scale mode FILL' },
    ]);
    expect(JSON.stringify(tree)).not.toContain('abc');
  });

  it('reads shadows as an array with offset, radius and spread', async () => {
    const node = frame([], {
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.25 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 1,
        },
      ],
    });
    expect((await readLayerTree(node)).tree.effects).toEqual([
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: { hex: '#000000', alpha: 0.25, r: 0, g: 0, b: 0 },
        offsetX: 0,
        offsetY: 4,
        radius: 8,
        spread: 1,
      },
    ]);
  });

  it('reads instance targets (the set name for a variant) and property references', async () => {
    const icon = {
      id: 'i1',
      type: 'INSTANCE',
      name: 'Icon',
      visible: true,
      width: 16,
      height: 16,
      componentPropertyReferences: { visible: 'show-icon#12:1', mainComponent: 'icon#3287:0' },
      getMainComponentAsync: async () => ({
        id: '3253:1',
        name: 'size=16',
        parent: { type: 'COMPONENT_SET', name: 'icon/arrow-right' },
      }),
    };
    const { tree } = await readLayerTree(icon);
    expect(tree.instanceOf).toEqual({ componentId: '3253:1', componentName: 'icon/arrow-right' });
    expect(tree.propertyRefs).toEqual({ visible: 'show-icon#12:1', mainComponent: 'icon#3287:0' });
  });

  describe('tokens', () => {
    const resolve = (kind: 'variable' | 'style', id: string) =>
      ({ 'variable:V1': '--color-primary-500', 'style:S1': '--text-body' })[`${kind}:${id}`];

    it('attaches variable and style tokens and reports which were used', async () => {
      const node = frame([textNode({ textStyleId: 'S1' })], {
        fills: [
          solid(0, 0, 1, { boundVariables: { color: { type: 'VARIABLE_ALIAS', id: 'V1' } } }),
        ],
      });
      const r = await readLayerTree(node, { resolveToken: resolve });
      expect(r.tree.fills?.[0].token).toEqual({ variableId: 'V1', cssName: '--color-primary-500' });
      expect(r.tree.children[0].text?.styleId).toBe('S1');
      expect(r.tree.children[0].text?.token).toEqual({ styleId: 'S1', cssName: '--text-body' });
      expect(r.usedVariableIds).toEqual(['V1']);
      expect(r.usedStyleIds).toEqual(['S1']);
    });

    it('drops a token it cannot resolve, keeps the value, and warns once', async () => {
      const bound = (id: string) =>
        solid(1, 0, 0, { boundVariables: { color: { type: 'VARIABLE_ALIAS', id } } });
      const node = frame([textNode({ fills: [bound('GONE')] })], { fills: [bound('GONE')] });
      const r = await readLayerTree(node, { resolveToken: resolve });
      expect(r.tree.fills?.[0]).toMatchObject({ hex: '#ff0000' });
      expect(r.tree.fills?.[0].token).toBeUndefined();
      expect(r.warnings.filter((w) => w.code === 'UNRESOLVED_REFERENCE')).toHaveLength(1);
      expect(r.usedVariableIds).toEqual([]);
    });

    it('writes no tokens without a resolver', async () => {
      const node = frame([], {
        fills: [solid(0, 0, 1, { boundVariables: { color: { id: 'V1' } } })],
      });
      const r = await readLayerTree(node);
      expect(r.tree.fills?.[0].token).toBeUndefined();
      expect(r.warnings).toEqual([]);
    });
  });

  describe('stopping early and counting', () => {
    const wide = (n: number) =>
      frame(Array.from({ length: n }, (_, i) => textNode({ id: `t${i}` })));

    it('cuts the tree short when shouldStop turns true, and flags it truncated', async () => {
      let calls = 0;
      const r = await readLayerTree(wide(50), { shouldStop: () => ++calls > 5 });
      expect(r.truncated).toBe(true);
      expect(r.tree.children).toHaveLength(5);
      expect(r.warnings.map((w) => w.code)).toContain('TREE_TRUNCATED');
    });

    it('hands control back before every layer when yieldIfDue is given', async () => {
      let yields = 0;
      await readLayerTree(wide(6), {
        yieldIfDue: async () => {
          yields++;
        },
      });
      expect(yields).toBe(7); // the root and six children
    });

    it('counts trees, layers and instance lookups, with the time the lookups took', async () => {
      const instance = (id: string) => ({
        id,
        type: 'INSTANCE',
        name: 'Icon',
        visible: true,
        getMainComponentAsync: async () => {
          await new Promise((r) => setTimeout(r, 5));
          return { id: 'm', name: 'icon' };
        },
      });
      const stats = newReadStats();
      await readLayerTree(frame([instance('a'), instance('b'), textNode()]), { stats });
      expect(stats).toMatchObject({ trees: 1, layers: 4, instanceLookups: 2 });
      expect(stats.instanceMs).toBeGreaterThanOrEqual(8);
    });
  });

  describe('budgets', () => {
    const wide = (n: number) =>
      frame(Array.from({ length: n }, (_, i) => textNode({ id: `t${i}` })));

    it('stops at the layer budget, flags it and warns, without throwing', async () => {
      const r = await readLayerTree(wide(50), { maxLayers: 10 });
      expect(r.truncated).toBe(true);
      expect(r.tree.children.length).toBeLessThan(50);
      expect(r.warnings.map((w) => w.code)).toContain('TREE_TRUNCATED');
    });

    it('stops at the depth budget', async () => {
      let node: object = textNode();
      for (let i = 0; i < 15; i++) node = frame([node], { id: `d${i}` });
      const r = await readLayerTree(node, { maxDepth: 4 });
      expect(r.truncated).toBe(true);
      let depth = 0;
      for (let l = r.tree; l.children.length; l = l.children[0]) depth++;
      expect(depth).toBe(4);
    });

    it('is not truncated within budget', async () => {
      const r = await readLayerTree(wide(3));
      expect(r.truncated).toBe(false);
      expect(r.warnings).toEqual([]);
    });
  });

  it('produces a tree that fits the published schema', async () => {
    const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
    const ajv = new Ajv({ strict: false, allErrors: true });
    ajv.addSchema(schema);
    const validateLayer = ajv.compile({ $ref: `${schema.$id}#/definitions/Layer` });
    const { tree } = await readLayerTree(frame([textNode(), frame([], { id: 'f2' })]));
    expect(validateLayer(tree)).toBe(true);
    expect(validateLayer.errors ?? []).toEqual([]);
  });
});
