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

describe('component doc file names', () => {
  it('treats names differing only by case as colliding', () => {
    const ds = makeDesignSystem();
    ds.components = [
      { ...ds.components[0], id: 'a', name: 'Button' },
      { ...ds.components[0], id: 'b', name: 'button' },
    ];
    const paths = generateComponentDocs(ds).map((f) => f.path);
    expect(paths.map((p) => p.toLowerCase())).toEqual([
      'components/button.md',
      'components/button-2.md',
    ]);
  });

  it('falls back to a safe name when the component name sanitizes to nothing', () => {
    const ds = makeDesignSystem();
    ds.components = [{ ...ds.components[0], name: '???' }];
    expect(generateComponentDocs(ds)[0].path).toBe('components/Component.md');
  });
});

describe('component doc layout section', () => {
  it('documents size, auto layout, gap, padding, and corner radius', () => {
    const ds = makeDesignSystem();
    ds.components[0].layout = {
      measuredFrom: 'Size=Large, State=Default',
      width: 120,
      height: 40,
      layoutMode: 'HORIZONTAL',
      gap: 8,
      padding: { top: 12, right: 16, bottom: 12, left: 16 },
      cornerRadius: 6,
    };
    const [file] = generateComponentDocs(ds);
    expect(file.content).toContain('## Layout');
    expect(file.content).toContain(
      '_Measured from the "Size=Large, State=Default" variant, in px._',
    );
    expect(file.content).toContain('| Size | 120 × 40 |');
    expect(file.content).toContain('| Auto layout | Horizontal |');
    expect(file.content).toContain('| Gap | 8 |');
    expect(file.content).toContain('| Padding (top, right, bottom, left) | 12, 16, 12, 16 |');
    expect(file.content).toContain('| Corner radius | 6 |');
  });

  it('describes fixed layouts without gap or padding rows', () => {
    const ds = makeDesignSystem();
    ds.components[0].layout = { measuredFrom: 'Icon', width: 24, height: 24, layoutMode: 'NONE' };
    const { content } = generateComponentDocs(ds)[0];
    expect(content).toContain('| Auto layout | None (fixed layout) |');
    expect(content).not.toContain('| Gap |');
  });

  it('omits the section entirely when no layout was measured', () => {
    const { content } = generateComponentDocs(makeDesignSystem())[0];
    expect(content).not.toContain('## Layout');
  });
});
