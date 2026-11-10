import { describe, expect, it } from 'vitest';
import { transformToDesignSystem } from '../../src/plugin/transform';
import { makeCssNamesUnique } from '../../src/plugin/transform/uniqueNames';
import type { StyleToken, VariableToken } from '../../src/shared/types';
import { generateCssFile } from '../../src/plugin/generators/cssFile';
import { makeComponent, makePaintStyle } from './fixtures';

const style = (id: string, name: string, cssName: string): StyleToken => ({
  id,
  name,
  path: name.split('/'),
  type: 'PAINT',
  description: '',
  cssName,
});
const none = { text: [], color: [], effect: [], grid: [] };

describe('makeCssNamesUnique', () => {
  it('keeps the first name and suffixes later ones, deterministically', () => {
    const color = [
      style('a', 'Divider ↓', '--divider'),
      style('b', 'Divider ↑', '--divider'),
      style('c', 'Divider →', '--divider'),
      style('d', 'Other', '--other'),
    ];
    const { renamed } = makeCssNamesUnique([], { ...none, color });
    expect(color.map((s) => s.cssName)).toEqual([
      '--divider',
      '--divider-2',
      '--divider-3',
      '--other',
    ]);
    expect(renamed).toBe(2);
  });

  it('does not reuse a suffixed name another token already has', () => {
    const color = [style('a', 'A', '--x'), style('b', 'B', '--x-2'), style('c', 'C', '--x')];
    makeCssNamesUnique([], { ...none, color });
    expect(color.map((s) => s.cssName)).toEqual(['--x', '--x-2', '--x-3']);
  });

  it('counts variables first, then styles, so a variable keeps its name over a style', () => {
    const variable = { id: 'v', cssName: '--color-x' } as VariableToken;
    const color = [style('s', 'Color X', '--color-x')];
    makeCssNamesUnique([variable], { ...none, color });
    expect(variable.cssName).toBe('--color-x');
    expect(color[0].cssName).toBe('--color-x-2');
  });

  it('changes nothing when every name is already distinct', () => {
    const color = [style('a', 'A', '--a'), style('b', 'B', '--b')];
    expect(makeCssNamesUnique([], { ...none, color }).renamed).toBe(0);
  });
});

describe('through the transform', () => {
  it('gives names that collapse to the same CSS name distinct CSS variables, so tokens.css keeps both', () => {
    const ds = transformToDesignSystem(
      {
        collections: [],
        variables: [],
        textStyles: [],
        paintStyles: [
          makePaintStyle({ id: 'S:1', name: 'Border/divider ↓' }),
          makePaintStyle({ id: 'S:2', name: 'Border/divider ↑' }),
        ],
        effectStyles: [],
        gridStyles: [],
        components: [makeComponent()],
        warnings: [],
      },
      'F',
    );
    const names = ds.styles.color.map((s) => s.cssName);
    expect(new Set(names).size).toBe(names.length);
    expect(ds.warnings.some((w) => w.includes('numeric suffix'))).toBe(true);
    const css = generateCssFile(ds).content;
    for (const n of names) expect(css).toContain(`${n}:`);
  });
});
