import { describe, expect, it } from 'vitest';
import { generateTokensJson } from '../../src/plugin/generators/tokensJson';
import { makeDesignSystem } from './fixtures';

describe('generateTokensJson', () => {
  it('produces tokens.json with the expected path', () => {
    const file = generateTokensJson(makeDesignSystem());
    expect(file.path).toBe('tokens.json');
  });

  it('produces valid JSON with metadata and category buckets', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.metadata.fileName).toBe('Fixture File');
    expect(parsed.color).toBeDefined();
    expect(parsed.semantic).toBeDefined();
  });

  it('nests color variable under its stripped path and resolves the default value to hex', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Primary['500'].$value).toBe('#3366ff');
    expect(parsed.color.Primary['500'].$type).toBe('color');
  });

  it('represents alias values as a DTCG-style reference', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.semantic.Color.Danger.$value).toBe('{Color.Primary.500}');
  });

  it('lists the components that bind a variable under $extensions.figma.usedBy', () => {
    const file = generateTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Primary['500'].$extensions.figma.usedBy).toEqual(['Button']);
    expect(parsed.semantic.Color.Danger.$extensions.figma.usedBy).toEqual([]);
  });

  it('falls back to color styles when no color variables exist', () => {
    const ds = makeDesignSystem();
    ds.variables = ds.variables.filter((v) => v.category !== 'color' && v.category !== 'semantic');
    const file = generateTokensJson(ds);
    const parsed = JSON.parse(file.content);

    expect(parsed.color.Surface.Background.$value).toBe('#ffffff');
  });

  it('handles an empty design system without throwing', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles = { text: [], color: [], effect: [], grid: [] };
    expect(() => generateTokensJson(ds)).not.toThrow();
  });
});
