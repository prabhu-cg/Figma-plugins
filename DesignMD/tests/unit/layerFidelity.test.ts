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
  it('keep their stops, transform and opacity', async () => {
    const fill = {
      type: 'GRADIENT_LINEAR',
      visible: true,
      opacity: 0.5,
      blendMode: 'MULTIPLY',
      gradientStops: [
        { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
        { position: 1, color: { r: 0, g: 0, b: 1, a: 0.25 } },
      ],
      gradientTransform: [
        [0, 1, 0],
        [-1, 0, 1],
      ],
    };
    const tree = checked((await readLayerTree(node('FRAME', 'Card', { fills: [fill] }))).tree);
    expect(tree.fills![0]).toMatchObject({
      type: 'GRADIENT_LINEAR',
      alpha: 0.5,
      blendMode: 'MULTIPLY',
      stops: [
        { position: 0, color: { hex: '#ff0000', alpha: 1 } },
        { position: 1, color: { hex: '#0000ff', alpha: 0.25 } },
      ],
      transform: [
        [0, 1, 0],
        [-1, 0, 1],
      ],
    });
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
    expect(diff.layers).toEqual([{ path: 'Root/Dot', changes: { position: { x: 10, y: 0 } } }]);
  });
});

describe('bindings to variables', () => {
  const resolveToken = (kind: string, id: string) =>
    kind === 'variable' ? `--${id.replace(/\W/g, '-')}` : undefined;

  it('lists number and string bindings by field, as tokens, and counts them as used', async () => {
    const frame = row([], {
      boundVariables: {
        paddingLeft: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:1' },
        itemSpacing: { type: 'VARIABLE_ALIAS', id: 'VariableID:1:2' },
        fills: [{ type: 'VARIABLE_ALIAS', id: 'VariableID:9:9' }],
        topLeftRadius: { type: 'VARIABLE_ALIAS', id: 'VariableID:not-in-file' },
      },
    });
    const r = await readLayerTree(frame, {
      resolveToken: (kind, id) =>
        id === 'VariableID:not-in-file' ? undefined : resolveToken(kind, id),
    });
    expect(r.tree.bindings).toEqual({
      itemSpacing: { variableId: 'VariableID:1:2', cssName: '--VariableID-1-2' },
      paddingLeft: { variableId: 'VariableID:1:1', cssName: '--VariableID-1-1' },
    });
    expect(r.usedVariableIds.sort()).toEqual(['VariableID:1:1', 'VariableID:1:2']);
    expect(r.warnings.map((w) => w.code)).toEqual(['UNRESOLVED_REFERENCE']);
    checked(r.tree);
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
        'textCase',
        'textDecoration',
      ].sort(),
    );
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
