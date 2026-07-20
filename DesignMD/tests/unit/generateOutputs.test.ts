import { describe, expect, it } from 'vitest';
import { generateOutputs } from '../../src/plugin/generators';
import { makeDesignSystem } from './fixtures';

describe('generateOutputs', () => {
  it('generates all four output kinds when every option is enabled', () => {
    const files = generateOutputs(makeDesignSystem(), {
      designMd: true,
      componentDocs: true,
      tokensJson: true,
      cssTokensJson: true,
      zip: true,
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain('design.md');
    expect(paths).toContain('tokens.json');
    expect(paths).toContain('css-tokens.json');
    expect(paths.some((p) => p.startsWith('components/'))).toBe(true);
  });

  it('only generates the selected output kinds', () => {
    const files = generateOutputs(makeDesignSystem(), {
      designMd: true,
      componentDocs: false,
      tokensJson: false,
      cssTokensJson: false,
      zip: false,
    });
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('design.md');
  });

  it('returns an empty array when no output kinds are selected', () => {
    const files = generateOutputs(makeDesignSystem(), {
      designMd: false,
      componentDocs: false,
      tokensJson: false,
      cssTokensJson: false,
      zip: false,
    });
    expect(files).toEqual([]);
  });
});
