import { describe, expect, it } from 'vitest';
import { generateCssTokensJson } from '../../src/plugin/generators/cssTokensJson';
import { makeDesignSystem } from './fixtures';

describe('generateCssTokensJson', () => {
  it('produces css-tokens.json with the expected path', () => {
    const file = generateCssTokensJson(makeDesignSystem());
    expect(file.path).toBe('css-tokens.json');
  });

  it('emits a root css variable for each color variable using its default mode', () => {
    const file = generateCssTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);
    expect(parsed.root['--color-primary-500']).toBe('#3366ff');
  });

  it('emits a var() reference for alias values', () => {
    const file = generateCssTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);
    expect(parsed.root['--semantic-color-danger']).toBe('var(--color-primary-500)');
  });

  it('emits non-default modes under a separate modes map', () => {
    const file = generateCssTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);
    expect(parsed.modes.Dark['--color-primary-500']).toBe('#1a3399');
  });

  it('falls back to effect styles for box-shadow css vars', () => {
    const file = generateCssTokensJson(makeDesignSystem());
    const parsed = JSON.parse(file.content);
    expect(parsed.root['--elevation-card']).toContain('#00000033');
  });

  it('handles an empty design system without throwing', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.styles = { text: [], color: [], effect: [], grid: [] };
    expect(() => generateCssTokensJson(ds)).not.toThrow();
  });
});

describe('generateCssTokensJson alias naming', () => {
  it('uses the same css name as the target variable for camelCase names', () => {
    const ds = makeDesignSystem();
    const target = ds.variables.find((v) => v.category === 'color')!;
    target.name = 'fontSize/Base';
    target.path = ['fontSize', 'Base'];
    target.cssName = '--font-size-base';
    const alias = ds.variables.find((v) => v.valuesByMode[0]?.value.kind === 'alias')!;
    alias.valuesByMode[0].value = {
      kind: 'alias',
      variableId: target.id,
      variableName: 'fontSize/Base',
    };
    const parsed = JSON.parse(generateCssTokensJson(ds).content);
    expect(parsed.root[alias.cssName]).toBe('var(--font-size-base)');
  });
});
