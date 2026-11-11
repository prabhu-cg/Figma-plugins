import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readLayerTree } from '../../src/plugin/extraction/layers';
import { diffVariant } from '../../src/plugin/transform/variantDiffs';
import type { Layer } from '../../src/shared/componentsSchema';

const MIXED = Symbol('figma.mixed');
const solid = (r = 0, g = 0, b = 0, extra: object = {}) => ({
  type: 'SOLID',
  color: { r, g, b },
  opacity: 1,
  visible: true,
  ...extra,
});
const node = (type: string, name: string, over: object = {}, children?: unknown[]) => ({
  id: `${name}:id`,
  type,
  name,
  visible: true,
  width: 100,
  height: 40,
  ...(children ? { children } : {}),
  ...over,
});
const textNode = (name: string, over: object = {}) =>
  node('TEXT', name, {
    characters: 'Hello world',
    fontName: { family: 'Inter', style: 'Regular' },
    fontWeight: 400,
    fontSize: 14,
    lineHeight: { unit: 'AUTO' },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textAlignHorizontal: 'LEFT',
    fills: [solid()],
    ...over,
  });
const row = (children: unknown[], over: object = {}) =>
  node('FRAME', 'Row', { layoutMode: 'HORIZONTAL', itemSpacing: 8, ...over }, children);

const schema = JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8'));
const ajv = new Ajv({ strict: false, allErrors: true });
ajv.addSchema(schema);
const validateLayer = ajv.compile({ $ref: `${schema.$id}#/definitions/Layer` });
const checked = (tree: Layer) => {
  expect(validateLayer(tree), JSON.stringify(validateLayer.errors)).toBe(true);
  return tree;
};

describe('gradients', () => {
  const stops = [
    { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
    { position: 1, color: { r: 0, g: 0, b: 1, a: 0.25 } },
  ];
  const gradient = (type: string, transform: number[][], extra: object = {}) => ({
    type,
    visible: true,
    opacity: 1,
    gradientStops: stops,
    gradientTransform: transform,
    ...extra,
  });
  const read = async (fill: object, size = { width: 200, height: 100 }) =>
    checked((await readLayerTree(node('FRAME', 'Card', { ...size, fills: [fill] }))).tree)
      .fills![0];

  it('keep their stops as hex and alpha, the opacity, the blend mode and the transform', async () => {
    const paint = await read(
      gradient(
        'GRADIENT_LINEAR',
        [
          [1, 0, 0],
          [0, 1, 0],
        ],
        { opacity: 0.5, blendMode: 'MULTIPLY' },
      ),
    );
    expect(paint).toMatchObject({
      type: 'GRADIENT_LINEAR',
      opacity: 0.5,
      blendMode: 'MULTIPLY',
      stops: [
        { position: 0, hex: '#ff0000', alpha: 1 },
        { position: 1, hex: '#0000ff', alpha: 0.25 },
      ],
      transform: [
        [1, 0, 0],
        [0, 1, 0],
      ],
    });
    expect(paint).not.toHaveProperty('alpha');
  });

  it('give a linear gradient its CSS angle: 90 is left to right, 180 top to bottom', async () => {
    const leftToRight = await read(
      gradient('GRADIENT_LINEAR', [
        [1, 0, 0],
        [0, 1, 0],
      ]),
    );
    expect(leftToRight.angle).toBe(90);
    // Figma's transform for a top-to-bottom gradient.
    const topToBottom = await read(
      gradient('GRADIENT_LINEAR', [
        [0, 1, 0],
        [-1, 0, 1],
      ]),
    );
    expect(topToBottom.angle).toBe(180);
    // Right to left, and bottom to top.
    expect(
      (
        await read(
          gradient('GRADIENT_LINEAR', [
            [-1, 0, 1],
            [0, 1, 0],
          ]),
        )
      ).angle,
    ).toBe(270);
    expect(
      (
        await read(
          gradient('GRADIENT_LINEAR', [
            [0, -1, 1],
            [1, 0, 0],
          ]),
        )
      ).angle,
    ).toBe(0);
  });

  it('measures the angle in pixels, so a diagonal across a wide box is not 45 degrees', async () => {
    // Corner to corner of a 200 x 100 box: direction (200, 100) in px.
    const paint = await read(
      gradient('GRADIENT_LINEAR', [
        [1, 0, 0],
        [0, 1, 0],
      ]),
      { width: 200, height: 100 },
    );
    expect(paint.angle).toBe(90);
    const diagonal = await read(
      gradient('GRADIENT_LINEAR', [
        [0.5, -0.5, 0.5],
        [0.5, 0.5, 0],
      ]),
      { width: 200, height: 100 },
    );
    // This transform runs from the bottom-left to the top-right corner: in px that is (200, -100),
    // so the CSS angle is atan2(200, 100) = 63.43, not the 45 a square box would give.
    expect(diagonal.angle).toBeCloseTo(63.43, 1);
  });

  it('give a radial gradient its centre and radii as fractions of the box', async () => {
    const paint = await read(
      gradient('GRADIENT_RADIAL', [
        [1, 0, 0],
        [0, 1, 0],
      ]),
    );
    expect(paint.center).toEqual({ x: 0.5, y: 0.5 });
    expect(paint.radii).toEqual({ x: 0.5, y: 0.5 });
    expect(paint).not.toHaveProperty('angle');
  });

  it("keep an angular or diamond gradient's type and stops, and warn once per kind", async () => {
    const r = await readLayerTree(
      node('FRAME', 'Card', {}, [
        node('FRAME', 'A', {
          fills: [
            gradient('GRADIENT_ANGULAR', [
              [1, 0, 0],
              [0, 1, 0],
            ]),
          ],
        }),
        node('FRAME', 'B', {
          fills: [
            gradient('GRADIENT_ANGULAR', [
              [1, 0, 0],
              [0, 1, 0],
            ]),
          ],
        }),
        node('FRAME', 'C', {
          fills: [
            gradient('GRADIENT_DIAMOND', [
              [1, 0, 0],
              [0, 1, 0],
            ]),
          ],
        }),
      ]),
    );
    expect(r.tree.children[0].fills![0]).toMatchObject({ type: 'GRADIENT_ANGULAR' });
    expect(r.tree.children[0].fills![0].stops).toHaveLength(2);
    expect(r.tree.children[0].fills![0]).not.toHaveProperty('angle');
    expect(r.warnings.filter((w) => w.code === 'UNSUPPORTED_GRADIENT')).toHaveLength(2);
  });

  it('ignore a malformed transform and unreadable stops instead of failing', async () => {
    const fill = {
      type: 'GRADIENT_RADIAL',
      visible: true,
      gradientStops: [{}, null],
      gradientTransform: [[1]],
    };
    const { tree } = await readLayerTree(node('FRAME', 'Card', { fills: [fill] }));
    expect(tree.fills![0].stops).toBeUndefined();
    expect(tree.fills![0].transform).toBeUndefined();
    expect(tree.fills![0].center).toBeUndefined();
  });

  it('skip a gradient whose transform cannot be inverted', async () => {
    const paint = await read(
      gradient('GRADIENT_LINEAR', [
        [0, 0, 0],
        [0, 0, 0],
      ]),
    );
    expect(paint.angle).toBeUndefined();
  });
});

describe('strokes', () => {
  it('keep each side when they differ, plus dash, cap, join and miter limit', async () => {
    const tree = checked(
      (
        await readLayerTree(
          node('FRAME', 'Box', {
            strokes: [solid(1, 1, 1)],
            strokeWeight: MIXED,
            strokeTopWeight: 0,
            strokeRightWeight: 0,
            strokeBottomWeight: 2,
            strokeLeftWeight: 0,
            strokeAlign: 'INSIDE',
            dashPattern: [4, 2],
            strokeCap: 'ROUND',
            strokeJoin: 'MITER',
            strokeMiterLimit: 8,
          }),
        )
      ).tree,
    );
    expect(tree.strokes).toMatchObject({
      weight: 2,
      sides: { top: 0, right: 0, bottom: 2, left: 0 },
      dash: [4, 2],
      cap: 'ROUND',
      miterLimit: 8,
    });
    expect(tree.strokes).not.toHaveProperty('join');
  });

  it('write nothing extra for a plain uniform stroke', async () => {
    const { tree } = await readLayerTree(
      node('FRAME', 'Box', {
        strokes: [solid()],
        strokeWeight: 1,
        strokeTopWeight: 1,
        strokeRightWeight: 1,
        strokeBottomWeight: 1,
        strokeLeftWeight: 1,
        strokeJoin: 'MITER',
        strokeCap: 'NONE',
        strokeMiterLimit: 4,
        dashPattern: [],
      }),
    );
    expect(tree.strokes).toEqual({ paints: expect.any(Array), weight: 1, align: 'INSIDE' });
  });
});

describe('placement and position', () => {
  it('records sizing, grow and align for every child of an auto-layout frame, even a text layer', async () => {
    const label = textNode('Label', {
      layoutSizingHorizontal: 'FILL',
      layoutSizingVertical: 'HUG',
      layoutGrow: 1,
      layoutAlign: 'STRETCH',
      layoutPositioning: 'AUTO',
    });
    const tree = checked((await readLayerTree(row([label]))).tree);
    expect(tree.children[0].placement).toEqual({
      positioning: 'AUTO',
      grow: 1,
      align: 'STRETCH',
      sizingH: 'FILL',
      sizingV: 'HUG',
    });
    expect(tree.children[0].position).toBeUndefined();
    expect(tree.placement).toBeUndefined();
  });

  it('records x, y and constraints for children of a frame without auto layout', async () => {
    const dot = node('ELLIPSE', 'Dot', {
      x: 12.345,
      y: 4,
      constraints: { horizontal: 'MAX', vertical: 'STRETCH' },
    });
    const tree = checked(
      (await readLayerTree(node('FRAME', 'Badge', { layoutMode: 'NONE' }, [dot]))).tree,
    );
    expect(tree.children[0].position).toEqual({ x: 12.35, y: 4 });
    expect(tree.children[0].constraints).toEqual({ horizontal: 'MAX', vertical: 'STRETCH' });
    expect(tree.children[0].placement).toBeUndefined();
  });

  it('records position and constraints for an absolute child of an auto-layout frame', async () => {
    const badge = node('FRAME', 'Badge', {
      layoutPositioning: 'ABSOLUTE',
      x: 80,
      y: -4,
      constraints: { horizontal: 'MAX', vertical: 'MIN' },
    });
    const { tree } = await readLayerTree(row([badge]));
    expect(tree.children[0].placement?.positioning).toBe('ABSOLUTE');
    expect(tree.children[0].position).toEqual({ x: 80, y: -4 });
  });

  it('records rotation, size limits, clipping, mask, blend mode and corner smoothing', async () => {
    const child = node('RECTANGLE', 'Shape', {
      rotation: 45,
      isMask: true,
      blendMode: 'MULTIPLY',
      cornerSmoothing: 0.6,
    });
    const tree = checked(
      (
        await readLayerTree(
          row([child], { clipsContent: true, minWidth: 80, maxWidth: null, minHeight: 24 }),
        )
      ).tree,
    );
    expect(tree.clipsContent).toBe(true);
    expect(tree.sizeLimits).toEqual({ minWidth: 80, minHeight: 24 });
    expect(tree.children[0]).toMatchObject({
      rotation: 45,
      isMask: true,
      blendMode: 'MULTIPLY',
      cornerSmoothing: 0.6,
    });
  });

  it('says a frame does not clip when it does not, and leaves the field off non-frames', async () => {
    const { tree } = await readLayerTree(
      node('FRAME', 'F', { clipsContent: false }, [node('RECTANGLE', 'R', { clipsContent: true })]),
    );
    expect(tree.clipsContent).toBe(false);
    expect(tree.children[0].clipsContent).toBeUndefined();
  });

  it('records layout extras and layout grids', async () => {
    const tree = checked(
      (
        await readLayerTree(
          row([], {
            layoutWrap: 'WRAP',
            counterAxisSpacing: 12,
            counterAxisAlignContent: 'SPACE_BETWEEN',
            itemReverseZIndex: true,
            strokesIncludedInLayout: true,
            layoutGrids: [
              {
                pattern: 'COLUMNS',
                visible: true,
                count: 12,
                gutterSize: 16,
                offset: 24,
                alignment: 'STRETCH',
              },
              { pattern: 'GRID', visible: false, sectionSize: 8 },
              { pattern: 'WAT' },
            ],
          }),
        )
      ).tree,
    );
    expect(tree.layout).toMatchObject({
      wrap: true,
      counterGap: 12,
      counterAlignContent: 'SPACE_BETWEEN',
      reverseZIndex: true,
      strokesIncludedInLayout: true,
    });
    expect(tree.layoutGrids).toEqual([
      {
        pattern: 'COLUMNS',
        visible: true,
        count: 12,
        gutterSize: 16,
        offset: 24,
        alignment: 'STRETCH',
      },
      { pattern: 'GRID', visible: false, sectionSize: 8 },
    ]);
  });

  it('variant diffs see a moved layer', () => {
    const make = (x: number): Layer => ({
      id: 'r',
      name: 'Root',
      type: 'FRAME',
      visible: true,
      children: [
        {
          id: 'c',
          name: 'Dot',
          type: 'ELLIPSE',
          visible: true,
          position: { x, y: 0 },
          children: [],
        },
      ],
    });
    const { diff } = diffVariant(make(0), make(10), { variantId: 'v', variantProperties: {} });
    expect(diff.layers).toEqual([
      { path: 'Root/Dot', layerId: 'c', changes: { position: { x: 10, y: 0 } } },
    ]);
  });
});

describe('bindings to variables', () => {
  const resolveToken = (kind: string, id: string) =>
    kind === 'variable' ? `--${id.replace(/\W/g, '-')}` : undefined;

  it('puts gap and padding next to the numbers in layout.token, and the rest in bindings', async () => {
    const frame = row([], {
      boundVariables: {
        paddingLeft: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:1' },
        itemSpacing: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' },
        cornerRadius: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:3' },
        fills: [{ type: 'VARIABLE_ALIAS', id: 'VariableID:9:9' }],
        topLeftRadius: { type: 'VARIABLE_ALIAS', id: 'VariableID:not-in-file' },
      },
    });
    const r = await readLayerTree(frame, {
      resolveToken: (kind, id) =>
        id === 'VariableID:not-in-file' ? undefined : resolveToken(kind, id),
    });
    expect(r.tree.layout!.token).toEqual({
      gap: { variableId: 'VariableID:1:2', cssName: '--VariableID-1-2' },
      padding: { left: { variableId: 'VariableID:1:1', cssName: '--VariableID-1-1' } },
    });
    expect(r.tree.bindings).toEqual({
      cornerRadius: { variableId: 'VariableID:1:3', cssName: '--VariableID-1-3' },
    });
    expect(r.usedVariableIds.sort()).toEqual([
      'VariableID:1:1',
      'VariableID:1:2',
      'VariableID:1:3',
    ]);
    expect(r.warnings.map((w) => w.code)).toEqual(['UNRESOLVED_REFERENCE']);
    checked(r.tree);
  });

  it('leaves out bindings and layout.token when nothing is bound to a layout number', async () => {
    const { tree } = await readLayerTree(
      row([], { boundVariables: { itemSpacing: { id: 'unknown' } } }),
      { resolveToken: () => undefined },
    );
    expect(tree.layout!.token).toBeUndefined();
    expect(tree.bindings).toBeUndefined();
  });

  it('writes none without a way to look tokens up', async () => {
    const { tree } = await readLayerTree(
      row([], { boundVariables: { gap: { id: 'VariableID:1:1' } } }),
    );
    expect(tree.bindings).toBeUndefined();
  });
});

describe('text', () => {
  it('records italic, box behaviour, truncation, vertical alignment and paragraph spacing', async () => {
    const tree = checked(
      (
        await readLayerTree(
          textNode('Title', {
            fontName: { family: 'Inter', style: 'Semi Bold Italic' },
            textAutoResize: 'HEIGHT',
            textTruncation: 'ENDING',
            maxLines: 2,
            textAlignVertical: 'CENTER',
            paragraphSpacing: 8,
            paragraphIndent: 12,
            hyperlink: { type: 'URL', value: 'https://example.com' },
            getRangeListOptions: () => ({ type: 'UNORDERED' }),
          }),
        )
      ).tree,
    );
    expect(tree.text).toMatchObject({
      italic: true,
      autoResize: 'HEIGHT',
      truncation: 'ENDING',
      maxLines: 2,
      alignVertical: 'CENTER',
      paragraphSpacing: 8,
      paragraphIndent: 12,
      hyperlink: 'https://example.com',
      listType: 'UNORDERED',
    });
  });

  it('writes none of the optional text fields for plain text', async () => {
    const { tree } = await readLayerTree(
      textNode('Plain', {
        textAutoResize: 'WIDTH_AND_HEIGHT',
        textTruncation: 'DISABLED',
        maxLines: null,
        textAlignVertical: 'TOP',
        paragraphSpacing: 0,
        paragraphIndent: 0,
        hyperlink: null,
        getRangeListOptions: () => ({ type: 'NONE' }),
      }),
    );
    expect(Object.keys(tree.text!).sort()).toEqual(
      [
        'align',
        'autoResize',
        'characters',
        'fontFamily',
        'fontSize',
        'fontWeight',
        'letterSpacing',
        'lineHeight',
        'maxLines',
        'textCase',
        'textDecoration',
        'truncation',
      ].sort(),
    );
  });

  it('says explicitly when text is not truncated and has no line limit', async () => {
    const { tree } = await readLayerTree(
      textNode('Plain', { textTruncation: 'DISABLED', maxLines: null, leadingTrim: 'NONE' }),
    );
    expect(tree.text).toMatchObject({ truncation: 'NONE', maxLines: null, leadingTrim: 'NONE' });
    const trimmed = await readLayerTree(textNode('T', { leadingTrim: 'CAP_HEIGHT', maxLines: 3 }));
    expect(trimmed.tree.text).toMatchObject({ leadingTrim: 'CAP_HEIGHT', maxLines: 3 });
    checked(trimmed.tree);
  });

  it('keeps a different colour per run when the text colours are mixed', async () => {
    const segments = [
      {
        characters: 'Hello ',
        fills: [solid(0, 0, 0)],
        hyperlink: null,
        listOptions: { type: 'NONE' },
      },
      {
        characters: 'world',
        fills: [solid(1, 0, 0)],
        hyperlink: { type: 'URL', value: 'https://x.test' },
        listOptions: { type: 'ORDERED' },
      },
    ].map((s) => ({
      fontName: { family: 'Inter', style: 'Regular' },
      fontWeight: 400,
      fontSize: 14,
      lineHeight: { unit: 'AUTO' },
      letterSpacing: { unit: 'PIXELS', value: 0 },
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      textStyleId: '',
      ...s,
    }));
    const t = textNode('Mixed', { fills: MIXED, getStyledTextSegments: () => segments });
    const { tree } = await readLayerTree(t);
    checked(tree);
    expect(tree.fills).toBeUndefined();
    expect(tree.text!.mixed).toBe(true);
    expect(tree.text!.runs!.map((r) => r.fills?.[0].hex)).toEqual(['#000000', '#ff0000']);
    expect(tree.text!.runs![1]).toMatchObject({ hyperlink: 'https://x.test', listType: 'ORDERED' });
    // The layer-level fields describe the first run but do not copy its colour or link.
    expect(tree.text).not.toHaveProperty('fills');
  });
});

describe('box and drawn opacity', () => {
  /** An absolute transform that places a node's top-left corner at (x, y) on the page. */
  const at = (x: number, y: number, width = 10, height = 10) => ({
    width,
    height,
    absoluteTransform: [
      [1, 0, x],
      [0, 1, y],
    ],
  });

  it("measures every layer from the root, with the layer's own size", async () => {
    const tree = checked(
      (
        await readLayerTree(
          node('FRAME', 'Root', at(100, 200, 300, 400), [
            node('FRAME', 'Card', at(110, 220, 280, 100.126), [
              node('TEXT', 'Label', { ...at(120.5, 230, 50, 20), characters: 'x' }),
            ]),
            node('RECTANGLE', 'NoTransform', { width: 5, height: 5 }),
          ]),
        )
      ).tree,
    );
    expect(tree.box).toEqual({ x: 0, y: 0, width: 300, height: 400 });
    expect(tree.children[0].box).toEqual({ x: 10, y: 20, width: 280, height: 100.13 });
    expect(tree.children[0].box!.width).toBe(tree.children[0].size!.width);
    expect(tree.children[0].children[0].box).toEqual({ x: 20.5, y: 30, width: 50, height: 20 });
    expect(tree.children[1].box).toBeUndefined();
  });

  it('includes hidden layers, so hidden can be told from missing', async () => {
    const { tree } = await readLayerTree(
      node('FRAME', 'Root', at(0, 0, 100, 100), [
        node('RECTANGLE', 'Ghost', { visible: false, ...at(30, 40, 5, 6) }),
      ]),
    );
    expect(tree.children[0].visible).toBe(false);
    expect(tree.children[0].box).toEqual({ x: 30, y: 40, width: 5, height: 6 });
  });

  it('uses the origin a rotation turns about, not the box around the rotated layer', async () => {
    // A 40 x 10 layer rotated 90 degrees about its top-left corner at (50, 60).
    const { tree } = await readLayerTree(
      node('FRAME', 'Root', at(0, 0, 100, 100), [
        node('RECTANGLE', 'Bar', {
          width: 40,
          height: 10,
          rotation: 90,
          absoluteBoundingBox: { x: 40, y: 60, width: 10, height: 40 },
          absoluteTransform: [
            [0, -1, 50],
            [1, 0, 60],
          ],
        }),
      ]),
    );
    expect(tree.children[0].box).toEqual({ x: 50, y: 60, width: 40, height: 10 });
    expect(tree.children[0].rotation).toBe(90);
  });

  it('writes no box when the root has no transform', async () => {
    const { tree } = await readLayerTree(node('FRAME', 'Root', {}, [node('FRAME', 'A', at(1, 1))]));
    expect(tree.children[0].box).toBeUndefined();
  });

  it('multiplies opacity down the tree and writes it only when it is not 1', async () => {
    const tree = checked(
      (
        await readLayerTree(
          node('FRAME', 'Root', { opacity: 1 }, [
            node('FRAME', 'Half', { opacity: 0.5 }, [
              node('RECTANGLE', 'Inner', { opacity: 0.5 }),
              node('RECTANGLE', 'Plain', { opacity: 1 }),
            ]),
            node('RECTANGLE', 'Opaque', { opacity: 1 }),
          ]),
        )
      ).tree,
    );
    expect(tree.effectiveOpacity).toBeUndefined();
    expect(tree.children[0].effectiveOpacity).toBe(0.5);
    expect(tree.children[0].children.map((c) => c.effectiveOpacity)).toEqual([0.25, 0.5]);
    expect(tree.children[1].effectiveOpacity).toBeUndefined();
  });

  it('variant diffs list the new box of a layer that moved or grew', () => {
    const make = (h: number): Layer => ({
      id: 'r',
      name: 'Root',
      type: 'FRAME',
      visible: true,
      box: { x: 0, y: 0, width: 100, height: h },
      children: [
        {
          id: 'c',
          name: 'Dot',
          type: 'ELLIPSE',
          visible: true,
          box: { x: 0, y: h - 10, width: 10, height: 10 },
          children: [],
        },
      ],
    });
    const { diff } = diffVariant(make(50), make(80), { variantId: 'v', variantProperties: {} });
    expect(diff.layers).toEqual([
      { path: 'Root', layerId: 'r', changes: { box: { x: 0, y: 0, width: 100, height: 80 } } },
      { path: 'Root/Dot', layerId: 'c', changes: { box: { x: 0, y: 70, width: 10, height: 10 } } },
    ]);
  });
});

describe('fonts', () => {
  it('collects each family and style once, with weight and italic, including mixed-style runs', async () => {
    const seg = (style: string, weight: number) => ({
      characters: 'x',
      fontName: { family: 'Playfair', style },
      fontWeight: weight,
      fontSize: 12,
      lineHeight: { unit: 'AUTO' },
      letterSpacing: { unit: 'PIXELS', value: 0 },
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      textStyleId: '',
      fills: [solid()],
      hyperlink: null,
      listOptions: { type: 'NONE' },
    });
    const tree = node('FRAME', 'Root', {}, [
      textNode('A'),
      textNode('B'),
      textNode('C', {
        fontName: { family: 'Inter', style: 'Semi Bold Italic' },
        fontWeight: 600,
      }),
      textNode('Mixed', {
        fontName: MIXED,
        getStyledTextSegments: () => [seg('Regular', 400), seg('Bold Italic', 700)],
      }),
    ]);
    const { usedFonts } = await readLayerTree(tree);
    const sorted = [...usedFonts].sort((a, b) =>
      (a.family + a.style).localeCompare(b.family + b.style),
    );
    expect(sorted).toEqual([
      { family: 'Inter', style: 'Regular', weight: 400, italic: false },
      { family: 'Inter', style: 'Semi Bold Italic', weight: 600, italic: true },
      { family: 'Playfair', style: 'Bold Italic', weight: 700, italic: true },
      { family: 'Playfair', style: 'Regular', weight: 400, italic: false },
    ]);
  });
});
