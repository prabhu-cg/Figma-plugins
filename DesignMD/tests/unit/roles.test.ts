import { describe, expect, it } from 'vitest';
import type { Layer } from '../../src/shared/componentsSchema';
import { assignRoles, inferRole } from '../../src/plugin/transform/roles';

const layer = (over: Partial<Layer>): Layer => ({
  id: '1:1',
  name: 'Layer',
  type: 'FRAME',
  visible: true,
  children: [],
  ...over,
});
const child = layer({ id: '1:2' });

describe('inferRole', () => {
  it('marks the root', () => {
    expect(inferRole(layer({ name: 'Button' }), true)).toEqual({
      role: 'root',
      roleSource: 'type',
    });
  });

  it('uses a TEXT property first: short text is a label, long or multi-line text is text', () => {
    const base = { type: 'TEXT', name: 'Heading', propertyRefs: { characters: 'label#1:0' } };
    expect(inferRole(layer({ ...base, text: { characters: 'Save' } as never }))).toEqual({
      role: 'label',
      roleSource: 'property',
    });
    expect(inferRole(layer({ ...base, text: { characters: 'a\nb' } as never })).role).toBe('text');
    expect(inferRole(layer({ ...base, text: { characters: 'x'.repeat(41) } as never })).role).toBe(
      'text',
    );
    // text content turned off: the property alone makes it a label
    expect(inferRole(layer(base)).role).toBe('label');
  });

  it('turns an INSTANCE_SWAP into an icon when small and a slot otherwise', () => {
    const refs = { mainComponent: 'icon#1:0' };
    expect(
      inferRole(layer({ type: 'INSTANCE', propertyRefs: refs, size: { width: 16, height: 16 } })),
    ).toEqual({ role: 'icon', roleSource: 'property' });
    expect(
      inferRole(layer({ type: 'INSTANCE', propertyRefs: refs, size: { width: 300, height: 200 } })),
    ).toEqual({ role: 'slot', roleSource: 'property' });
  });

  it('ignores a visibility-only property and falls through', () => {
    const r = inferRole(
      layer({ name: 'Frame', propertyRefs: { visible: 'show#1:0' }, children: [child] }),
    );
    expect(r).toEqual({ role: 'container', roleSource: 'type' });
  });

  it('uses the node type: image fill, line, thin rectangle, small vector', () => {
    const img = layer({
      type: 'RECTANGLE',
      fills: [{ type: 'IMAGE', visible: true }],
    });
    expect(inferRole(img)).toEqual({ role: 'image', roleSource: 'type' });
    expect(inferRole(layer({ type: 'LINE' })).role).toBe('divider');
    expect(inferRole(layer({ type: 'RECTANGLE', size: { width: 200, height: 1 } })).role).toBe(
      'divider',
    );
    expect(inferRole(layer({ type: 'VECTOR', size: { width: 12, height: 12 } }))).toEqual({
      role: 'icon',
      roleSource: 'type',
    });
    expect(inferRole(layer({ type: 'VECTOR', size: { width: 400, height: 300 } })).role).toBe(
      'unknown',
    );
  });

  it('does not treat a hidden image fill as an image', () => {
    const r = inferRole(layer({ type: 'RECTANGLE', fills: [{ type: 'IMAGE', visible: false }] }));
    expect(r.role).toBe('unknown');
  });

  it('falls back to the name, marked as name-sourced', () => {
    expect(inferRole(layer({ name: 'Page Title', type: 'TEXT' }))).toEqual({
      role: 'heading',
      roleSource: 'name',
    });
    expect(inferRole(layer({ name: 'cta-button', children: [child] })).role).toBe('button');
    expect(inferRole(layer({ name: 'icon_left', children: [child] })).role).toBe('icon');
    expect(inferRole(layer({ name: 'Avatar' })).role).toBe('image');
  });

  it('does not guess from ambiguous words: a menu item in a dropdown is not an input, "Content" is not a slot', () => {
    expect(
      inferRole(layer({ name: 'Dropdown / menu item', type: 'INSTANCE', children: [child] })),
    ).toEqual({
      role: 'container',
      roleSource: 'type',
    });
    expect(inferRole(layer({ name: 'Select', children: [child] })).role).toBe('container');
    expect(inferRole(layer({ name: 'Left Content', children: [child] })).role).toBe('container');
    // real inputs and slots are still found
    expect(inferRole(layer({ name: 'Text input', children: [child] })).role).toBe('input');
    expect(inferRole(layer({ name: 'Left slot', children: [child] })).role).toBe('slot');
  });

  it('uses the name of the component an instance points at when its own name says nothing', () => {
    const inst = (name: string, componentName: string) =>
      layer({ name, type: 'INSTANCE', instanceOf: { componentId: 'c', componentName } });
    expect(inferRole(inst('Left', 'components/button'))).toEqual({
      role: 'button',
      roleSource: 'name',
    });
    expect(inferRole(inst('Slot A', 'icon / arrow-right')).role).toBe('slot'); // own name wins
    expect(inferRole(inst('Start', 'icon / arrow-right')).role).toBe('icon');
    expect(inferRole(inst('Start', 'date-picker'))).toEqual({
      role: 'unknown',
      roleSource: 'none',
    });
  });

  it('matches whole words only', () => {
    expect(inferRole(layer({ name: 'Iconography', children: [child] })).roleSource).toBe('type');
    expect(inferRole(layer({ name: 'Linkedin', type: 'TEXT' })).role).toBe('text');
  });

  it('gives plain text and containers their type, and everything else unknown', () => {
    expect(inferRole(layer({ type: 'TEXT', name: 'Text' }))).toEqual({
      role: 'text',
      roleSource: 'type',
    });
    expect(inferRole(layer({ name: 'Wrapper', children: [child] }))).toEqual({
      role: 'container',
      roleSource: 'type',
    });
    expect(inferRole(layer({ name: 'Wrapper' }))).toEqual({ role: 'unknown', roleSource: 'none' });
  });
});

describe('assignRoles', () => {
  it('sets roles through the tree without changing the input', () => {
    const tree = layer({
      name: 'Button',
      children: [
        layer({ id: '2', type: 'TEXT', name: 'Label', propertyRefs: { characters: 'l#1' } }),
      ],
    });
    const out = assignRoles(tree);
    expect(out.role).toBe('root');
    expect(out.children[0]).toMatchObject({ role: 'label', roleSource: 'property' });
    expect(tree.role).toBeUndefined();
    expect(tree.children[0].role).toBeUndefined();
  });
});
