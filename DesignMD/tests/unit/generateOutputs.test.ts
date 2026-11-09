import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPORT_OPTIONS } from '../../src/shared/messages';
import { generateOutputs, generateOutputsDetailed } from '../../src/plugin/generators';
import { makeDesignSystem } from './fixtures';

describe('generateOutputsDetailed: partial success', () => {
  const broken = () => ({ ...makeDesignSystem(), components: null as never });

  it('still returns the other outputs when one fails, with the reason', () => {
    const { files, failures } = generateOutputsDetailed(broken(), {
      ...DEFAULT_EXPORT_OPTIONS,
      designMd: false,
      componentDocs: true,
      cssFile: true,
    });
    expect(files.map((f) => f.path)).toEqual(['tokens.css']);
    expect(failures).toHaveLength(1);
    expect(failures[0].output).toBe('Component docs');
    expect(failures[0].reason.length).toBeGreaterThan(0);
  });

  it('reports no failures when everything succeeds', () => {
    const { files, failures } = generateOutputsDetailed(makeDesignSystem(), DEFAULT_EXPORT_OPTIONS);
    expect(failures).toEqual([]);
    expect(files.length).toBeGreaterThan(0);
  });

  it('generateOutputs stays strict and throws, naming the failed output', () => {
    expect(() =>
      generateOutputs(broken(), {
        ...DEFAULT_EXPORT_OPTIONS,
        designMd: false,
        componentDocs: true,
      }),
    ).toThrow(/Component docs/);
  });
});

describe('generateOutputs', () => {
  it('generates every output kind when every option is enabled', () => {
    const files = generateOutputs(makeDesignSystem(), {
      designMd: true,
      componentDocs: true,
      tokensJson: true,
      zip: true,
    });
    const paths = files.map((f) => f.path);
    expect(paths).toContain('design.md');
    expect(paths).toContain('tokens.json');
    expect(paths.some((p) => p.startsWith('components/'))).toBe(true);
  });

  it('only generates the selected output kinds', () => {
    const files = generateOutputs(makeDesignSystem(), {
      designMd: true,
      componentDocs: false,
      tokensJson: false,
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
      zip: false,
    });
    expect(files).toEqual([]);
  });
});
