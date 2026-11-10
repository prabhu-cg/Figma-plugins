/**
 * An end-to-end check on a file that looks like a real design system: primitive and semantic
 * variables with aliases and light/dark modes, a hidden collection, text/paint/effect styles, and
 * components bound to all of them (plus a library style and a hidden variable that cannot be
 * resolved). It runs the real scan, transform, layer reading and generation against the fake
 * Figma API and checks the outputs against each other. It is a stand-in for running the plugin on
 * a token-rich file in Figma, not a replacement for it.
 */
import Ajv from 'ajv';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { extractDesignSystem } from '../../src/plugin/extraction';
import { extractStructures } from '../../src/plugin/extraction/structures';
import { generateOutputsDetailed } from '../../src/plugin/generators';
import { transformToDesignSystem } from '../../src/plugin/transform';
import { findBrokenRefs } from '../../src/shared/componentsRefs';
import type { ComponentsFileV1 } from '../../src/shared/componentsSchema';
import { DEFAULT_EXPORT_OPTIONS } from '../../src/shared/messages';
import {
  alias,
  component,
  componentSet,
  document,
  fakeCollection,
  fakeEffectStyle,
  fakePaintStyle,
  fakeTextStyle,
  fakeVariable,
  installFakeFigma,
  node,
  page,
  resetFakeIds,
} from './helpers/fakeFigma';

beforeEach(resetFakeIds);
afterEach(() => vi.unstubAllGlobals());

const rgb = (r: number, g: number, b: number) => ({ r, g, b, a: 1 });
const boundColor = (id: string) => ({ color: { type: 'VARIABLE_ALIAS', id } });
const solid = (r: number, g: number, b: number, bound?: string) => ({
  type: 'SOLID',
  color: { r, g, b },
  opacity: 1,
  visible: true,
  ...(bound ? { boundVariables: boundColor(bound) } : {}),
});
const text = (name: string, props: object = {}) =>
  node('TEXT', name, {
    visible: true,
    width: 60,
    height: 20,
    characters: 'Label',
    fontName: { family: 'Inter', style: 'Regular' },
    fontWeight: 400,
    fontSize: 14,
    lineHeight: { unit: 'PIXELS', value: 20 },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    textAlignHorizontal: 'LEFT',
    fills: [solid(0, 0, 0)],
    ...props,
  });
// ---- the design system's variables -------------------------------------------------------------

const PRIM = 'VariableCollectionId:prim';
const SEM = 'VariableCollectionId:sem';
const HID = 'VariableCollectionId:hid';

function buildVariables() {
  const primitives = ['100', '500', '600', '900'].flatMap((shade, i) => [
    fakeVariable({
      id: `VariableID:blue-${shade}`,
      name: `Color/Blue/${shade}`,
      variableCollectionId: PRIM,
      valuesByMode: { 'm:value': rgb(0.1, 0.2 + i * 0.1, 0.9 - i * 0.1) },
    }),
    fakeVariable({
      id: `VariableID:gray-${shade}`,
      name: `Color/Gray/${shade}`,
      variableCollectionId: PRIM,
      valuesByMode: { 'm:value': rgb(0.1 * (i + 1), 0.1 * (i + 1), 0.1 * (i + 1)) },
    }),
  ]);
  const spacing = [0, 4, 8, 16].map((px) =>
    fakeVariable({
      id: `VariableID:space-${px}`,
      name: `Spacing/${px}`,
      variableCollectionId: PRIM,
      resolvedType: 'FLOAT',
      valuesByMode: { 'm:value': px },
    }),
  );
  const semantic = [
    ['Color/Action/Default', 'blue-500', 'blue-500'],
    ['Color/Action/Hover', 'blue-600', 'blue-100'],
    ['Color/Surface/Page', 'gray-100', 'gray-900'],
    ['Color/Text/Default', 'gray-900', 'gray-100'],
  ].map(([name, light, dark]) =>
    fakeVariable({
      id: `VariableID:sem-${name.split('/').slice(1).join('-').toLowerCase()}`,
      name,
      variableCollectionId: SEM,
      valuesByMode: {
        'm:light': alias(`VariableID:${light}`),
        'm:dark': alias(`VariableID:${dark}`),
      },
    }),
  );
  const hidden = fakeVariable({
    id: 'VariableID:hidden-1',
    name: 'Internal/Debug',
    variableCollectionId: HID,
    valuesByMode: { 'm:value': rgb(1, 0, 1) },
  });
  return { primitives, spacing, semantic, hidden };
}

const ACTION = 'VariableID:sem-action-default';
const ACTION_HOVER = 'VariableID:sem-action-hover';
const TEXT_DEFAULT = 'VariableID:sem-text-default';
const SURFACE = 'VariableID:sem-surface-page';

function buildFile() {
  const button = componentSet(
    'Button',
    [
      {
        props: { Variant: 'primary', State: 'default' },
        extra: { width: 120, height: 40, cornerRadius: 8, fills: [solid(0.1, 0.5, 0.9, ACTION)] },
        children: [
          text('Label', {
            textStyleId: 'S:text:body',
            componentPropertyReferences: { characters: 'label#1:0' },
          }),
          node('INSTANCE', 'Icon', {
            visible: true,
            width: 16,
            height: 16,
            componentPropertyReferences: { mainComponent: 'icon#1:1', visible: 'show-icon#1:2' },
            getMainComponentAsync: async () => ({
              id: 'icon-arrow',
              name: 'size=16',
              parent: { type: 'COMPONENT_SET', name: 'icon/arrow' },
            }),
          }),
        ],
      },
      {
        props: { Variant: 'primary', State: 'hover' },
        extra: {
          width: 120,
          height: 40,
          cornerRadius: 8,
          fills: [solid(0.1, 0.6, 0.8, ACTION_HOVER)],
        },
        children: [
          text('Label', {
            textStyleId: 'S:text:body',
            componentPropertyReferences: { characters: 'label#1:0' },
          }),
          node('INSTANCE', 'Icon', {
            visible: true,
            width: 16,
            height: 16,
            componentPropertyReferences: { mainComponent: 'icon#1:1', visible: 'show-icon#1:2' },
            getMainComponentAsync: async () => ({
              id: 'icon-arrow',
              name: 'size=16',
              parent: { type: 'COMPONENT_SET', name: 'icon/arrow' },
            }),
          }),
        ],
      },
    ],
    {
      componentPropertyDefinitions: {
        Variant: { type: 'VARIANT', defaultValue: 'primary', variantOptions: ['primary'] },
        State: { type: 'VARIANT', defaultValue: 'default', variantOptions: ['default', 'hover'] },
        'label#1:0': { type: 'TEXT', defaultValue: 'Button' },
        'show-icon#1:2': { type: 'BOOLEAN', defaultValue: true },
        'icon#1:1': { type: 'INSTANCE_SWAP', defaultValue: 'icon-arrow' },
      },
    },
  );
  const arrow = component('icon/arrow', { id: 'icon-arrow', width: 16, height: 16 });

  const nestedBadge = node(
    'INSTANCE',
    'Badge',
    {
      visible: true,
      width: 40,
      height: 20,
      componentPropertyReferences: { visible: 'has-badge#2:1' },
    },
    [text('Count', { componentPropertyReferences: { characters: 'count#nested:1' } })],
  );
  const mixedText = text('Title', {
    fontName: Symbol('mixed'),
    fontSize: Symbol('mixed'),
    fontWeight: Symbol('mixed'),
    getStyledTextSegments: () => [
      {
        characters: 'Hello ',
        fontName: { family: 'Inter', style: 'Regular' },
        fontWeight: 400,
        fontSize: 16,
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
        fontSize: 16,
        lineHeight: { unit: 'AUTO' },
        letterSpacing: { unit: 'PIXELS', value: 0 },
        textCase: 'ORIGINAL',
        textDecoration: 'NONE',
        textStyleId: '',
      },
    ],
  });
  const card = component(
    'Card',
    {
      width: 280,
      height: 160,
      layoutMode: 'VERTICAL',
      itemSpacing: 8,
      paddingTop: 16,
      paddingRight: 16,
      paddingBottom: 16,
      paddingLeft: 16,
      cornerRadius: Symbol('mixed'),
      topLeftRadius: 12,
      topRightRadius: 12,
      bottomRightRadius: 0,
      bottomLeftRadius: 0,
      fills: [solid(1, 1, 1, SURFACE)],
      strokes: [solid(0, 0, 0, TEXT_DEFAULT)],
      strokeWeight: 1,
      strokeAlign: 'INSIDE',
      effectStyleId: 'S:effect:card',
      effects: [
        {
          type: 'DROP_SHADOW',
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.2 },
          offset: { x: 0, y: 2 },
          radius: 8,
          spread: 1,
        },
      ],
      componentPropertyDefinitions: { 'has-badge#2:1': { type: 'BOOLEAN', defaultValue: true } },
    },
    [mixedText, nestedBadge],
  );
  // Uses a library style and a hidden variable, neither of which the file's tokens contain.
  const banner = component(
    'Banner',
    {
      width: 300,
      height: 48,
      fills: [solid(0.5, 0.5, 0.5, 'VariableID:hidden-1')],
      fillStyleId: 'S:remote,999:1',
    },
    [text('Message', { textStyleId: 'S:text:remote,999:2' })],
  );

  return {
    root: document('Design System', [page('Components', [button, arrow, card, banner])]),
    button,
  };
}

async function scan(structureOptions: { includeInstanceInternals?: boolean } = {}) {
  resetFakeIds();
  const { primitives, spacing, semantic, hidden } = buildVariables();
  const { root } = buildFile();
  installFakeFigma({
    root,
    collections: [
      fakeCollection({
        id: PRIM,
        name: 'Primitives',
        modes: [{ modeId: 'm:value', name: 'Value' }],
        defaultModeId: 'm:value',
        variableIds: [...primitives, ...spacing].map((v) => v.id),
      }),
      fakeCollection({
        id: SEM,
        name: 'Semantic',
        defaultModeId: 'm:light',
        variableIds: semantic.map((v) => v.id),
      }),
      fakeCollection({
        id: HID,
        name: '.internal',
        modes: [{ modeId: 'm:value', name: 'Value' }],
        defaultModeId: 'm:value',
        variableIds: [hidden.id],
        hiddenFromPublishing: true,
      }),
    ],
    variables: [...primitives, ...spacing, ...semantic, hidden],
    textStyles: [fakeTextStyle({ id: 'S:text:body', name: 'Body/Regular', fontSize: 14 })],
    paintStyles: [fakePaintStyle({ id: 'S:paint:surface', name: 'Surface/Card' })],
    effectStyles: [fakeEffectStyle({ id: 'S:effect:card', name: 'Elevation/Card' })],
    // a library paint style the Banner uses; the library text style it uses is not available
    libraryStyles: [
      {
        // Figma reports the style under its key alone; layers carry key plus node id.
        ...fakePaintStyle({ id: 'S:remote,', name: 'Library/Surface/Muted' }),
        requestedAs: 'S:remote,999:1',
        type: 'PAINT',
      },
    ],
  });
  const raw = await extractDesignSystem();
  const ds = transformToDesignSystem(raw, 'Design System', 'file');
  const structures = await extractStructures(ds.components, {
    ...structureOptions,
    resolveToken: (kind, id) =>
      kind === 'variable'
        ? ds.variables.find((v) => v.id === id)?.cssName
        : [...ds.styles.text, ...ds.styles.color, ...ds.styles.effect, ...ds.styles.grid].find(
            (s) => s.id === id,
          )?.cssName,
  });
  const { files, failures } = generateOutputsDetailed(
    ds,
    { ...DEFAULT_EXPORT_OPTIONS, tokensJson: true, cssFile: true, componentsJson: true },
    { structures },
  );
  const get = (path: string) => files.find((f) => f.path === path)!.content;
  return {
    ds,
    files,
    failures,
    get,
    componentsJson: JSON.parse(get('components.json')) as ComponentsFileV1,
    tokensJson: JSON.parse(get('tokens.json')),
  };
}

const validate = new Ajv({ strict: false, allErrors: true }).compile(
  JSON.parse(readFileSync('schemas/designmd-components-v1.json', 'utf8')),
);

describe('a token-rich design system, end to end', () => {
  it('produces every selected output without failures', async () => {
    const { files, failures } = await scan();
    expect(failures).toEqual([]);
    expect(files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        'design.md',
        'tokens.json',
        'tokens.css',
        'components.json',
        'components/Button.md',
      ]),
    );
  });

  it('writes a components.json that matches the schema and refers only to ids it contains', async () => {
    const { componentsJson } = await scan();
    expect(validate(componentsJson)).toBe(true);
    expect(validate.errors ?? []).toEqual([]);
    expect(findBrokenRefs(componentsJson, { checkInstances: false })).toEqual([]);
    expect(componentsJson.components.map((c) => c.name)).toEqual([
      'Banner',
      'Button',
      'Card',
      'icon/arrow',
    ]);
  });

  it('resolves semantic aliases to the primitive value of the default mode', async () => {
    const { componentsJson, ds } = await scan();
    const action = componentsJson.tokens[ACTION];
    expect(action).toMatchObject({
      type: 'color',
      cssName: ds.variables.find((v) => v.id === ACTION)!.cssName,
    });
    // light mode: Action/Default -> Blue/500
    const blue500 = ds.variables.find((v) => v.id === 'VariableID:blue-500')!;
    const primitive = blue500.valuesByMode[0].value;
    expect(primitive.kind).toBe('color');
    expect((action as { value: { hex: string } }).value.hex).toBe(
      (primitive as { color: { hex: string } }).color.hex.slice(0, 7).toLowerCase(),
    );
  });

  it('writes colour channels as 0 to 255, matching the hex', async () => {
    const { componentsJson } = await scan();
    const colours = Object.values(componentsJson.tokens).filter(
      (t) => t.type === 'color',
    ) as Array<{
      value: { hex: string; r: number; g: number; b: number };
    }>;
    expect(colours.length).toBeGreaterThan(0);
    for (const { value } of colours) {
      const h = (n: number) => n.toString(16).padStart(2, '0');
      expect(Number.isInteger(value.r) && value.r >= 0 && value.r <= 255).toBe(true);
      expect(`#${h(value.r)}${h(value.g)}${h(value.b)}`).toBe(value.hex);
    }
  });

  it('agrees with tokens.json on the id, CSS name and default value of every token it lists', async () => {
    const { componentsJson, tokensJson } = await scan();
    const leaves = new Map<
      string,
      { $value: unknown; $extensions: { figma: { id: string; cssName: string } } }
    >();
    const walk = (o: Record<string, unknown>) => {
      for (const v of Object.values(o)) {
        if (v && typeof v === 'object' && '$value' in v) {
          const leaf = v as { $extensions: { figma: { id: string } } };
          leaves.set(leaf.$extensions.figma.id, leaf as never);
        } else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
      }
    };
    walk(tokensJson);
    const ids = Object.keys(componentsJson.tokens);
    expect(ids.length).toBeGreaterThan(3);
    for (const id of ids) {
      const leaf = leaves.get(id);
      expect(leaf, `tokens.json has ${id}`).toBeDefined();
      expect(componentsJson.tokens[id].cssName).toBe(leaf!.$extensions.figma.cssName);
    }
  });

  it('binds layers to the variable and the styles they use, and records the change in a variant', async () => {
    const { componentsJson } = await scan();
    const button = componentsJson.components.find((c) => c.name === 'Button')!;
    expect(button.tree.fills?.[0].token).toMatchObject({ variableId: ACTION });
    const label = button.tree.children.find((l) => l.name === 'Label')!;
    expect(label.text?.styleId).toBe('S:text:body');
    expect(label.text?.token?.styleId).toBe('S:text:body');
    expect(button.boundVariableIds).toEqual(expect.arrayContaining([ACTION, ACTION_HOVER]));
    const hover = button.variantDiffs.find((d) => d.variantProperties.State === 'hover')!;
    expect(hover.layers[0].changes.fills?.[0].token).toMatchObject({ variableId: ACTION_HOVER });
  });

  it('reads layout, mixed corners, strokes, effect styles and mixed text on the standalone card', async () => {
    const { componentsJson } = await scan();
    const card = componentsJson.components.find((c) => c.name === 'Card')!;
    expect(card.tree.layout).toMatchObject({
      mode: 'VERTICAL',
      gap: 8,
      padding: { top: 16, left: 16 },
    });
    expect(card.tree.radius).toEqual({ tl: 12, tr: 12, br: 0, bl: 0 });
    expect(card.tree.strokes).toMatchObject({ weight: 1, align: 'INSIDE' });
    expect(card.tree.strokes?.paints[0].token).toMatchObject({ variableId: TEXT_DEFAULT });
    expect(card.tree.effects?.[0].token?.styleId).toBe('S:effect:card');
    const title = card.tree.children.find((l) => l.name === 'Title')!;
    expect(title.text?.mixed).toBe(true);
    expect(title.text?.runs?.map((r) => [r.characters, r.fontWeight])).toEqual([
      ['Hello ', 400],
      ['world', 700],
    ]);
  });

  it('gives swap properties readable defaults and instances the set name, in both outputs', async () => {
    const { componentsJson, get } = await scan();
    const button = componentsJson.components.find((c) => c.name === 'Button')!;
    const icon = button.properties.find((p) => p.name === 'icon')!;
    expect(icon).toMatchObject({
      key: 'icon#1:1',
      defaultResolved: { id: 'icon-arrow', name: 'icon/arrow' },
    });
    expect(button.tree.children.find((l) => l.name === 'Icon')!.instanceOf).toEqual({
      componentId: 'icon-arrow',
      componentName: 'icon/arrow',
    });
    const md = get('components/Button.md');
    expect(md).toContain('| icon | INSTANCE_SWAP | icon/arrow |');
    expect(md).not.toContain('#1:1');
  });

  it('keeps references inside the file: no property keys from nested instances', async () => {
    const { componentsJson } = await scan({ includeInstanceInternals: true });
    const card = componentsJson.components.find((c) => c.name === 'Card')!;
    const badge = card.tree.children.find((l) => l.name === 'Badge')!;
    expect(badge.propertyRefs).toEqual({ visible: 'has-badge#2:1' });
    expect(badge.children[0].propertyRefs).toBeUndefined();
  });

  it('resolves a library style to a token flagged as library, and keeps values and warns for one that is unavailable', async () => {
    const { componentsJson, tokensJson, ds } = await scan();
    const banner = componentsJson.components.find((c) => c.name === 'Banner')!;
    // the hidden variable cannot be resolved, so the layer falls back to its library style
    expect(banner.tree.fills?.[0]).toMatchObject({ hex: '#808080' });
    expect(banner.tree.fills?.[0].token).toMatchObject({ styleId: 'S:remote,999:1' });
    expect(banner.styleIds).toContain('S:remote,999:1');
    expect(componentsJson.tokens['S:remote,999:1']).toMatchObject({
      type: 'color',
      library: true,
      cssName: expect.stringContaining('library-surface-muted'),
    });
    // local tokens are not flagged
    expect(componentsJson.tokens[ACTION].library).toBeUndefined();

    // the unavailable library text style: no dangling id, values kept, and a warning
    const message = banner.tree.children.find((l) => l.name === 'Message')!;
    expect(message.text?.styleId).toBeUndefined();
    expect(message.text?.fontFamily).toBe('Inter');
    expect(
      componentsJson.warnings.some(
        (w) => w.code === 'UNRESOLVED_REFERENCE' && w.componentId === banner.id,
      ),
    ).toBe(true);

    // tokens.json carries the same token, flagged
    const leaves: Array<{ $extensions: { figma: { id: string; library?: boolean } } }> = [];
    const walk = (o: Record<string, unknown>) => {
      for (const v of Object.values(o)) {
        if (v && typeof v === 'object' && '$value' in v) leaves.push(v as never);
        else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
      }
    };
    walk(tokensJson);
    expect(
      leaves.find((l) => l.$extensions.figma.id === 'S:remote,999:1')?.$extensions.figma.library,
    ).toBe(true);

    // the summary counts what the file defines, not what it borrows
    expect(ds.summary.colorStylesCount).toBe(1);
    expect(ds.warnings.some((w) => w.includes('could not be read'))).toBe(true);
  });

  it('keeps hidden variables out of every output', async () => {
    const { files } = await scan();
    for (const f of files) expect(f.content, f.path).not.toContain('Internal/Debug');
  });

  it('is deterministic apart from the timestamp', async () => {
    const strip = (c: string) =>
      c.replace(/"generatedAt": "[^"]*"/, '').replace(/"contentHash": "[^"]*"/, '');
    const a = await scan();
    resetFakeIds();
    const b = await scan();
    expect(strip(a.get('components.json'))).toBe(strip(b.get('components.json')));
    expect(strip(a.get('tokens.json'))).toBe(strip(b.get('tokens.json')));
  });
});
