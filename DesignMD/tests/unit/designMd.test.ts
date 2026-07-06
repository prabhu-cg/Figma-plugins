import { describe, expect, it } from 'vitest';
import { generateDesignMd } from '../../src/plugin/generators/designMd';
import { makeDesignSystem } from './fixtures';

describe('generateDesignMd', () => {
  it('writes to design.md', () => {
    const file = generateDesignMd(makeDesignSystem());
    expect(file.path).toBe('design.md');
  });

  it('includes every required top-level section', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    const requiredHeadings = [
      '# Design System',
      '## Overview',
      '## Variable Collections',
      '## Color Tokens',
      '## Typography Tokens',
      '## Spacing Tokens',
      '## Effect Tokens',
      '## Grid Tokens',
      '## Components',
      '## Accessibility Notes',
      '## Naming Conventions',
      '## Design Principles',
    ];
    for (const heading of requiredHeadings) {
      expect(content).toContain(heading);
    }
  });

  it('renders a table row for the fixture color token', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    expect(content).toContain('--color-primary-500');
  });

  it('never crashes and shows actionable fallback text for a fully empty design system', () => {
    const ds = makeDesignSystem();
    ds.variables = [];
    ds.components = [];
    ds.styles = { text: [], color: [], effect: [], grid: [] };

    expect(() => generateDesignMd(ds)).not.toThrow();
    const { content } = generateDesignMd(ds);
    expect(content).toContain('No color variables or color styles found');
    expect(content).toContain('No components or component sets found');
  });

  it('falls back to color styles when there are no color variables', () => {
    const ds = makeDesignSystem();
    ds.variables = ds.variables.filter((v) => v.category !== 'color' && v.category !== 'semantic');
    const { content } = generateDesignMd(ds);
    expect(content).toContain('Falling back to Color Styles');
    expect(content).toContain('#ffffff');
  });
});
