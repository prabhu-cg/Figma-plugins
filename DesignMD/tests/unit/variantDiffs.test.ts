import { describe, expect, it } from 'vitest';
import type { Layer } from '../../src/shared/componentsSchema';
import { diffVariant } from '../../src/plugin/transform/variantDiffs';

const L = (name: string, over: Partial<Layer> = {}, children: Layer[] = []): Layer => ({
  id: `id-${name}-${Math.random()}`,
  name,
  type: 'FRAME',
  visible: true,
  children,
  ...over,
});
const fill = (hex: string) => [{ type: 'SOLID' as const, visible: true, hex, alpha: 1 }];
const info = { variantId: 'v2', variantProperties: { state: 'hover' }, componentId: 'c1' };

describe('diffVariant', () => {
  const base = () =>
    L('Button', { fills: fill('#1252f7'), radius: 8 }, [
      L('Label', { type: 'TEXT', visible: true }),
      L('Icon', { type: 'INSTANCE' }),
    ]);

  it('is empty for an identical variant, even though node ids differ', () => {
    const { diff, warnings } = diffVariant(base(), base(), info);
    expect(diff).toEqual({
      variantId: 'v2',
      variantProperties: { state: 'hover' },
      layers: [],
      added: [],
      removed: [],
    });
    expect(warnings).toEqual([]);
  });

  it('lists only the attributes that changed, keyed by name path', () => {
    const v = base();
    v.fills = fill('#0d3fc4');
    v.children[0].visible = false;
    const { diff } = diffVariant(base(), v, info);
    expect(diff.layers).toEqual([
      { path: 'Button', changes: { fills: fill('#0d3fc4') } },
      { path: 'Button/Label', changes: { visible: false } },
    ]);
  });

  it('treats a lost radius as radius 0, and ignores other attributes that went missing', () => {
    const v = base();
    delete v.radius;
    delete v.fills;
    const { diff } = diffVariant(base(), v, info);
    expect(diff.layers).toEqual([{ path: 'Button', changes: { radius: 0 } }]);
  });

  it('reports added and removed layers once, at the top-most layer', () => {
    const v = base();
    v.children = [v.children[0], L('Badge', {}, [L('BadgeText', { type: 'TEXT' })])];
    const { diff } = diffVariant(base(), v, info);
    expect(diff.removed).toEqual(['Button/Icon']);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].parentPath).toBe('Button');
    expect(diff.added[0].index).toBe(1);
    expect(diff.added[0].layer.name).toBe('Badge');
    expect(diff.added[0].layer.children[0].name).toBe('BadgeText');
  });

  it("gives each added layer its position among the parent's children in the variant", () => {
    const v = base();
    // New layers at the start, in the middle and at the end of the parent's children.
    v.children = [L('First'), v.children[0], L('Middle'), v.children[1], L('Last')];
    const { diff } = diffVariant(base(), v, info);
    expect(diff.added.map((a) => [a.layer.name, a.index])).toEqual([
      ['First', 0],
      ['Middle', 2],
      ['Last', 4],
    ]);
    // Rebuilding the variant from the default children, the removals and the indexes gives it back.
    const rebuilt = base().children.filter((c) => !diff.removed.includes(`Button/${c.name}`));
    for (const a of [...diff.added].sort((x, y) => x.index! - y.index!)) {
      rebuilt.splice(a.index!, 0, a.layer);
    }
    expect(rebuilt.map((c) => c.name)).toEqual(v.children.map((c) => c.name));
  });

  it('indexes an added layer inside a nested parent', () => {
    const b = L('Card', {}, [L('Body', {}, [L('Text', { type: 'TEXT' })])]);
    const v = L('Card', {}, [L('Body', {}, [L('Text', { type: 'TEXT' }), L('Avatar')])]);
    const { diff } = diffVariant(b, v, info);
    expect(diff.added.map((a) => [a.parentPath, a.index])).toEqual([['Card/Body', 1]]);
  });

  it('counts a layer whose type changed as removed plus added', () => {
    const v = base();
    v.children[1] = L('Icon', { type: 'RECTANGLE' });
    const { diff } = diffVariant(base(), v, info);
    expect(diff.removed).toEqual(['Button/Icon']);
    expect(diff.added.map((a) => a.layer.type)).toEqual(['RECTANGLE']);
  });

  it('tells duplicate siblings apart by index and warns once per group', () => {
    const twin = () =>
      L('Row', {}, [L('Dot', { fills: fill('#000000') }), L('Dot', { fills: fill('#000000') })]);
    const v = twin();
    v.children[1].fills = fill('#ffffff');
    const { diff, warnings } = diffVariant(twin(), v, info);
    expect(diff.layers).toEqual([{ path: 'Row/Dot[1]', changes: { fills: fill('#ffffff') } }]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'DUPLICATE_SIBLING_NAME', componentId: 'c1' });
  });

  it('does not mutate its inputs', () => {
    const b = base();
    const v = base();
    v.fills = fill('#000000');
    const snapshot = JSON.stringify([b, v]);
    diffVariant(b, v, info);
    expect(JSON.stringify([b, v])).toBe(snapshot);
  });
});
