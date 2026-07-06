import { describe, expect, it } from 'vitest';
import { generateComponentDocs } from '../../src/plugin/generators/componentMd';
import { makeDesignSystem } from './fixtures';

describe('generateComponentDocs', () => {
  it('generates one file per component under /components', () => {
    const ds = makeDesignSystem();
    const files = generateComponentDocs(ds);
    expect(files).toHaveLength(ds.components.length);
    expect(files[0].path).toBe('components/Button.md');
  });

  it('includes all required sections in a component doc', () => {
    const ds = makeDesignSystem();
    const [file] = generateComponentDocs(ds);
    const requiredHeadings = [
      '# Button',
      '## Description',
      '## Variants',
      '## Sizes',
      '## States',
      '## Properties',
      '## Accessibility Notes',
      '## Usage Guidelines',
      '## Token References',
      '## Related Components',
    ];
    for (const heading of requiredHeadings) {
      expect(file.content).toContain(heading);
    }
  });

  it('resolves bound variable ids to their token name in Token References', () => {
    const ds = makeDesignSystem();
    const [file] = generateComponentDocs(ds);
    expect(file.content).toContain('Color/Primary/500');
    expect(file.content).toContain('--color-primary-500');
  });

  it('disambiguates two components that sanitize to the same file name', () => {
    const ds = makeDesignSystem();
    ds.components = [...ds.components, { ...ds.components[0], id: 'dup', name: 'Button' }];
    const files = generateComponentDocs(ds);
    const paths = files.map((f) => f.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toContain('components/Button.md');
    expect(paths).toContain('components/Button-2.md');
  });

  it('returns an empty array when there are no components', () => {
    const ds = makeDesignSystem();
    ds.components = [];
    expect(generateComponentDocs(ds)).toEqual([]);
  });
});
