import { describe, expect, it } from 'vitest';
import {
  buildTokenTree,
  stripRedundantCategoryPrefix,
} from '../../src/plugin/generators/tokenTree';

const isLeaf = (v: unknown): v is { value: unknown } =>
  typeof v === 'object' && v !== null && 'value' in v;

describe('buildTokenTree', () => {
  it('nests entries by path segments', () => {
    const tree = buildTokenTree(
      [
        { path: ['primary', '500'], leaf: { value: '#f00' } },
        { path: ['primary', '600'], leaf: { value: '#e00' } },
        { path: ['secondary'], leaf: { value: '#0f0' } },
      ],
      isLeaf,
    );

    expect(tree).toEqual({
      primary: { '500': { value: '#f00' }, '600': { value: '#e00' } },
      secondary: { value: '#0f0' },
    });
  });

  it('disambiguates when a segment is both a leaf and a namespace', () => {
    const tree = buildTokenTree(
      [
        { path: ['spacing'], leaf: { value: 8 } },
        { path: ['spacing', 'lg'], leaf: { value: 24 } },
      ],
      isLeaf,
    );

    expect(tree.spacing).toEqual({ value: 8 });
    expect((tree as Record<string, unknown>).spacing_).toEqual({ lg: { value: 24 } });
  });

  it('ignores entries with an empty path', () => {
    const tree = buildTokenTree([{ path: [], leaf: { value: 1 } }], isLeaf);
    expect(tree).toEqual({});
  });
});

describe('stripRedundantCategoryPrefix', () => {
  it('drops a leading segment matching the category, case-insensitively', () => {
    expect(stripRedundantCategoryPrefix(['Color', 'Primary', '500'], 'color')).toEqual([
      'Primary',
      '500',
    ]);
  });

  it('leaves the path untouched when the first segment does not match', () => {
    expect(stripRedundantCategoryPrefix(['Brand', 'Primary'], 'color')).toEqual([
      'Brand',
      'Primary',
    ]);
  });

  it('leaves a single-segment path untouched even if it matches the category', () => {
    expect(stripRedundantCategoryPrefix(['color'], 'color')).toEqual(['color']);
  });
});
