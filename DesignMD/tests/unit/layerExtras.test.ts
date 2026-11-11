import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_VECTOR_CHARS, readLayerTree } from '../../src/plugin/extraction/layers';

const solid = (hex = 0) => ({
  type: 'SOLID',
  color: { r: hex, g: hex, b: hex },
  opacity: 1,
  visible: true,
});
const base = (type: string, over: object = {}) => ({
  id: `${type.toLowerCase()}:1`,
  type,
  name: type,
  visible: true,
  width: 16,
  height: 16,
  ...over,
});
const vectorNode = (over: object = {}) =>
  base('VECTOR', {
    fills: [solid()],
    strokes: [],
    fillGeometry: [{ windingRule: 'EVENODD', data: 'M 0 0 L 16 0 L 16 16 Z' }],
    strokeGeometry: [],
    ...over,
  });

const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema(schema);
const validateLayer = ajv.compile({ $ref: `${schema.$id}#/definitions/Layer` });

describe('vector shapes', () => {
  it('are left out unless asked for', async () => {
    const { tree } = await readLayerTree(vectorNode());
    expect(tree.vector).toBeUndefined();
  });

  it('are read as fill paths when the layer has a fill', async () => {
    const { tree } = await readLayerTree(vectorNode(), { includeVectorShapes: true });
    expect(tree.vector).toEqual({
      fill: [{ windingRule: 'EVENODD', data: 'M 0 0 L 16 0 L 16 16 Z' }],
      stroke: [],
    });
    expect(validateLayer(tree)).toBe(true);
  });

  it('read the stroke outline only when the layer has a stroke', async () => {
    const outline = [{ windingRule: 'NONZERO', data: 'M 1 1 L 2 2 Z' }];
    const stroked = vectorNode({
      fills: [],
      strokes: [solid(255)],
      strokeWeight: 2,
      fillGeometry: [{ windingRule: 'NONZERO', data: 'M 9 9 Z' }],
      strokeGeometry: outline,
    });
    const { tree } = await readLayerTree(stroked, { includeVectorShapes: true });
    expect(tree.vector).toEqual({ fill: [], stroke: outline });
  });

  it('are not read for rectangles, which size and radius already describe', async () => {
    const rect = base('RECTANGLE', { fills: [solid()], fillGeometry: [{ data: 'M 0 0 Z' }] });
    expect((await readLayerTree(rect, { includeVectorShapes: true })).tree.vector).toBeUndefined();
  });

  it('are not repeated for the parts of a boolean shape', async () => {
    const bool = base('BOOLEAN_OPERATION', {
      fills: [solid()],
      fillGeometry: [{ windingRule: 'NONZERO', data: 'M 0 0 L 4 4 Z' }],
      children: [vectorNode({ id: 'v:a' }), vectorNode({ id: 'v:b' })],
    });
    const { tree } = await readLayerTree(bool, { includeVectorShapes: true });
    expect(tree.vector?.fill).toHaveLength(1);
    expect(tree.children.map((c) => c.vector)).toEqual([undefined, undefined]);
  });

  it('leave out a shape over the size limit and say so', async () => {
    const huge = vectorNode({
      fillGeometry: [{ windingRule: 'NONZERO', data: 'M'.repeat(MAX_VECTOR_CHARS + 1) }],
    });
    const { tree, warnings } = await readLayerTree(huge, { includeVectorShapes: true });
    expect(tree.vector).toBeUndefined();
    expect(warnings.map((w) => w.code)).toEqual(['VECTOR_OMITTED']);
  });

  it('survive a geometry getter that throws', async () => {
    const hostile = vectorNode();
    Object.defineProperty(hostile, 'fillGeometry', {
      get() {
        throw new Error('nope');
      },
    });
    const { tree } = await readLayerTree(hostile, { includeVectorShapes: true });
    expect(tree.vector).toBeUndefined();
  });
});

describe('image fills', () => {
  const image = (over: object = {}) => ({
    type: 'IMAGE',
    imageHash: 'abc123',
    scaleMode: 'FILL',
    visible: true,
    ...over,
  });

  it('keep their hash out of the file when pictures are not exported', async () => {
    const { tree } = await readLayerTree(base('RECTANGLE', { fills: [image()] }));
    expect(tree.fills![0].image).toBeUndefined();
    expect(JSON.stringify(tree)).not.toContain('abc123');
  });

  it('carry the hash, the file and the picture size when exported', async () => {
    const { tree } = await readLayerTree(base('RECTANGLE', { fills: [image()] }), {
      resolveImage: async (hash) => ({
        file: `assets/images/${hash}.png`,
        width: 640,
        height: 480,
      }),
    });
    expect(tree.fills![0].image).toEqual({
      hash: 'abc123',
      scaleMode: 'FILL',
      file: 'assets/images/abc123.png',
      width: 640,
      height: 480,
    });
    expect(validateLayer(tree)).toBe(true);
  });

  it('keep tile scale, crop transform and rotation', async () => {
    const transform = [
      [1, 0, 0.25],
      [0, 1, 0.5],
    ];
    const { tree } = await readLayerTree(
      base('FRAME', {
        fills: [
          image({ scaleMode: 'TILE', scalingFactor: 0.5, rotation: 90 }),
          image({ scaleMode: 'CROP', imageTransform: transform }),
        ],
      }),
      { resolveImage: async () => ({ omitted: 'test' }) },
    );
    expect(tree.fills![0].image).toMatchObject({
      scaleMode: 'TILE',
      scalingFactor: 0.5,
      rotation: 90,
    });
    expect(tree.fills![1].image?.imageTransform).toEqual(transform);
    expect(validateLayer(tree)).toBe(true);
  });

  it('warn once per picture that could not be exported, and keep the hash', async () => {
    const node = base('FRAME', {
      fills: [image()],
      children: [base('RECTANGLE', { id: 'r:2', fills: [image()] })],
    });
    const { tree, warnings } = await readLayerTree(node, {
      resolveImage: async () => ({ omitted: 'it is too big.' }),
    });
    expect(tree.fills![0].image).toEqual({ hash: 'abc123', scaleMode: 'FILL' });
    expect(warnings.filter((w) => w.code === 'IMAGE_OMITTED')).toHaveLength(1);
  });
});

describe('instance properties and overrides', () => {
  const main = async () => ({
    id: 'main:1',
    name: 'Button',
    parent: { type: 'COMPONENT_SET', name: 'Button' },
  });
  const label = base('TEXT', {
    id: 'I9:1;5:2',
    name: 'Label',
    characters: 'Save',
    fontName: { family: 'Inter', style: 'Regular' },
    fontWeight: 400,
    fontSize: 14,
    lineHeight: { unit: 'AUTO' },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textAlignHorizontal: 'LEFT',
    fills: [solid()],
  });
  const instance = (over: object = {}) =>
    base('INSTANCE', {
      id: 'I9:1',
      name: 'Button',
      getMainComponentAsync: main,
      componentProperties: {
        'label#1:0': { type: 'TEXT', value: 'Save' },
        'icon#1:1': { type: 'BOOLEAN', value: false },
        size: { type: 'VARIANT', value: 'sm' },
        bad: { type: 'TEXT', value: Symbol('mixed') },
      },
      overrides: [
        { id: 'I9:1', overriddenFields: ['name', 'componentProperties'] },
        { id: 'I9:1;5:2', overriddenFields: ['characters', 'name'] },
        { id: 'I9:1;5:3', overriddenFields: ['name'] },
      ],
      children: [label],
      ...over,
    });
  const lookup = async (id: string) => (id === 'I9:1;5:2' ? label : null);

  it('lists the property values of this use, in key order, without unreadable ones', async () => {
    const { tree } = await readLayerTree(instance());
    expect(Object.keys(tree.instanceOf!.properties!)).toEqual(['icon#1:1', 'label#1:0', 'size']);
    expect(tree.instanceOf!.properties!['icon#1:1']).toEqual({ type: 'BOOLEAN', value: false });
  });

  it('lists what the use changed inside an instance whose insides are not read', async () => {
    const { tree } = await readLayerTree(instance(), {
      includeInstanceInternals: false,
      getNodeById: lookup,
    });
    expect(tree.children).toEqual([]);
    expect(tree.instanceOf!.overrides).toEqual([
      {
        layerId: 'I9:1;5:2',
        name: 'Label',
        changes: expect.objectContaining({
          text: expect.objectContaining({ characters: 'Save', fontSize: 14 }),
        }),
      },
    ]);
    // Only what the changed fields touch: no size, no fills.
    expect(Object.keys(tree.instanceOf!.overrides![0].changes)).toEqual(['text']);
    expect(validateLayer(tree)).toBe(true);
  });

  it('does not list overrides when the insides are read, because they carry the values', async () => {
    const { tree } = await readLayerTree(instance(), {
      includeInstanceInternals: true,
      getNodeById: lookup,
    });
    expect(tree.instanceOf!.overrides).toBeUndefined();
    expect(tree.children[0].text?.characters).toBe('Save');
  });

  it('caps overrides per instance and flags the list as cut short', async () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `I9:1;5:${i}`,
      overriddenFields: ['visible'],
    }));
    const { tree } = await readLayerTree(instance({ overrides: many }), {
      includeInstanceInternals: false,
      maxOverrides: 3,
      getNodeById: async (id) => base('RECTANGLE', { id, name: id, visible: false }),
    });
    expect(tree.instanceOf!.overrides).toHaveLength(3);
    expect(tree.instanceOf!.overridesTruncated).toBe(true);
  });

  it('skips a changed layer that cannot be found, and one whose lookup throws', async () => {
    const { tree } = await readLayerTree(instance(), {
      includeInstanceInternals: false,
      getNodeById: async () => {
        throw new Error('gone');
      },
    });
    expect(tree.instanceOf!.overrides).toBeUndefined();
  });
});
