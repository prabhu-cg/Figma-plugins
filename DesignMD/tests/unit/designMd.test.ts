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
      '## Token Usage',
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

  it('lists the fixture component under Referenced Variables for the token it binds', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    expect(content).toMatch(/Color\/Primary\/500.*Button/);
  });

  it('lists variables no component binds under Unused Variables', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    expect(content).toContain('Semantic/Color/Danger');
  });

  it('reports every variable as unused when there are no components', () => {
    const ds = makeDesignSystem();
    ds.components = [];
    ds.variables = ds.variables.map((v) => ({ ...v, usedByComponents: [] }));
    const { content } = generateDesignMd(ds);
    expect(content).toContain('0 of 2 variables (0%)');
  });

  it('breaks down component counts by page, counting each variant', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    expect(content).toContain('### Components by Page');
    // The fixture's Button is a component set with 2 variants on the "Components" page.
    expect(content).toMatch(/\| Components \| 2 \|/);
  });

  it('lists each component’s source page in the full table', () => {
    const { content } = generateDesignMd(makeDesignSystem());
    expect(content).toContain('### All Components');
    expect(content).toMatch(/\| Button \| Component Set \| Components \|/);
  });
});
