import { describe, expect, it } from 'vitest';
import { filterDesignSystemByPages } from '../../src/plugin/transform/pageFilter';
import { transformToDesignSystem } from '../../src/plugin/transform';
import { generateDesignMd } from '../../src/plugin/generators';
import { generateTokensJson } from '../../src/plugin/generators/tokensJson';
import {
  makeCollection,
  makeColorVariable,
  makeComponent,
  makeEffectStyle,
  makeGridStyle,
  makePaintStyle,
  makeTextStyle,
} from './fixtures';

function build() {
  return transformToDesignSystem(
    {
      collections: [makeCollection()],
      variables: [makeColorVariable()],
      textStyles: [makeTextStyle(), makeTextStyle({ id: 'style:text:2', name: 'Body/Small' })],
      paintStyles: [makePaintStyle()],
      effectStyles: [makeEffectStyle()],
      gridStyles: [makeGridStyle()],
      components: [
        makeComponent({ name: 'Button', styleIds: ['style:text:1', 'style:paint:1'] }),
        makeComponent({
          id: 'component:2',
          name: 'Card',
          pageName: 'Playground',
          styleIds: ['style:text:1', 'style:effect:1'],
        }),
      ],
      warnings: [],
    },
    'File',
  );
}

describe('style usage', () => {
  it('records which components apply each style, sorted', () => {
    const ds = build();
    expect(ds.styles.text[0].usedByComponents).toEqual(['Button', 'Card']);
    expect(ds.styles.text[1].usedByComponents).toEqual([]);
    expect(ds.styles.color[0].usedByComponents).toEqual(['Button']);
    expect(ds.styles.effect[0].usedByComponents).toEqual(['Card']);
    expect(ds.styles.grid[0].usedByComponents).toEqual([]);
  });

  it('recomputes usage when pages are excluded', () => {
    const filtered = filterDesignSystemByPages(build(), ['Playground']);
    expect(filtered.styles.text[0].usedByComponents).toEqual(['Button']);
    expect(filtered.styles.effect[0].usedByComponents).toEqual([]);
  });

  it('lists unapplied styles in design.md with a caveat', () => {
    const { content } = generateDesignMd(build());
    expect(content).toContain('## Style Usage');
    expect(content).toContain('3 of 5 styles (60%)');
    expect(content).toContain('### Styles Not Applied In Any Component');
    expect(content).toMatch(/\| Body\/Small \| Text \|/);
    expect(content).toMatch(/\| Layout\/12col \| Grid \|/);
    expect(content).not.toMatch(/\| Heading\/Large \| Text \|/);
    expect(content).toContain('not as safe to delete');
  });

  it('says so when every style is applied, and when there are no styles', () => {
    const ds = build();
    ds.styles.text = ds.styles.text.map((s) => ({ ...s, usedByComponents: ['X'] }));
    ds.styles.color = [];
    ds.styles.effect = [];
    ds.styles.grid = [];
    expect(generateDesignMd(ds).content).toContain(
      'Every style is applied inside at least one component.',
    );

    ds.styles.text = [];
    expect(generateDesignMd(ds).content).toContain(
      'No styles to cross-reference against components.',
    );
  });

  it('exports style usage under $extensions.figma.usedBy in tokens.json', () => {
    const ds = build();
    ds.variables = [];
    const parsed = JSON.parse(generateTokensJson(ds).content);
    expect(parsed.typography.Heading.Large.$extensions.figma.usedBy).toEqual(['Button', 'Card']);
  });
});
