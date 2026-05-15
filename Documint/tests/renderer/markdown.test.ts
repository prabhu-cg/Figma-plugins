import { renderMarkdown } from '@/plugin/renderer/markdown';
import type { RootManifest } from '@/types/schemas';

describe('renderMarkdown', () => {
  const createFixture = (overrides?: Partial<RootManifest>): RootManifest => {
    const base: RootManifest = {
      version: '1.0.0',
      generatedAt: '2024-04-29T12:00:00.000Z',
      source: {
        fileKey: 'abc123',
        fileName: 'MyDesignSystem',
        pageId: 'page1',
        pageName: 'Page 1',
        selectionIds: ['node1', 'node2'],
      },
      domains: {
        foundations: {
          colors: [
            {
              id: 'color1',
              tokenName: 'color/primary',
              label: 'Primary',
              value: { hex: '#0066CC', rgb: { r: 0, g: 102, b: 204 } },
              semanticRole: 'primary',
              source: 'style',
              variableMode: null,
              aliases: [],
              contrastOnWhite: 5.2,
              contrastOnBlack: 2.1,
              wcagAA: { white: true, black: false },
              wcagAAA: { white: true, black: false },
              usageHint: 'CTA buttons',
            },
          ],
          typography: [
            {
              id: 'typo1',
              tokenName: 'type/body',
              label: 'Body',
              fontFamily: 'Inter',
              fontWeight: 400,
              fontSize: '16px',
              lineHeight: { value: 1.5, unit: '%' },
              letterSpacing: { value: 0, unit: 'px' },
              textCase: 'none',
              textDecoration: 'none',
              role: 'body',
              source: 'style',
              usageHint: 'Body copy',
            },
          ],
          spacing: [
            {
              tokenName: 'space/4',
              label: 'Small',
              value: '4',
              unit: 'px',
              scaleBase: 4,
              scaleStep: 0,
              usageHint: 'Micro spacing',
            },
          ],
          grids: [
            {
              tokenName: 'grid/12col',
              label: '12-Column',
              type: 'columns',
              count: 12,
              gutter: '16px',
              margin: '20px',
              sectionSize: undefined,
              breakpointHint: 'desktop',
            },
          ],
        },
        components: {
          components: [
            {
              id: 'comp1',
              name: 'Button',
              description: 'Primary action button',
              category: 'Actions',
              anatomy: [
                {
                  partName: 'background',
                  nodeId: 'node1',
                  role: 'background',
                },
              ],
              variantGroups: [
                {
                  property: 'size',
                  type: 'variant',
                  values: ['small', 'medium', 'large'],
                },
              ],
              variants: [
                {
                  id: 'var1',
                  combination: { size: 'medium' },
                  nodeId: 'node2',
                },
              ],
              states: ['hover', 'active'],
              tokenBindings: {
                colors: [['background', 'color/primary']],
                typography: [['label', 'type/body']],
                spacing: [],
                effects: [],
              },
              accessibilityNotes: {
                role: 'button',
                keyboardInteraction: 'Enter or Space',
                ariaAttributes: ['aria-label'],
              },
              usageGuidelines: {
                when: 'Use for primary actions',
                whenNot: 'Do not use for secondary actions',
                antiPatterns: ['Do not disable without reason'],
              },
              doExamples: [{ label: 'Correct', description: 'Primary button with text' }],
              dontExamples: [{ label: 'Incorrect', description: 'Button with icon only' }],
            },
          ],
        },
        metadata: {
          pluginVersion: '1.0.0',
          schemaVersion: '1.0.0',
          generatedAt: '2024-04-29T12:00:00.000Z',
          source: {
            fileKey: 'abc123',
            fileName: 'MyDesignSystem',
            selectionIds: ['node1'],
          },
          counts: {
            colorTokens: 1,
            typographyTokens: 1,
            spacingTokens: 1,
            gridTokens: 1,
            components: 1,
            variants: 1,
            tokenBindings: 2,
          },
          exportFormats: ['markdown', 'figma-page'],
        },
        health: {
          overallScore: 85,
          breakdown: {
            foundationsScore: 90,
            componentsScore: 80,
            tokenCoverageScore: 75,
            namingConsistencyScore: 90,
          },
          warnings: [
            {
              severity: 'warning',
              domain: 'component',
              itemId: 'comp1',
              itemName: 'Button',
              code: 'NO_DESCRIPTION',
              message: 'Missing documentation',
              suggestion: 'Add usage guidelines',
            },
          ],
          missingFields: [],
          namingPatterns: {
            detected: ['kebab-case'],
            consistent: true,
            recommendation: 'Follow kebab-case naming',
          },
        },
      },
    };

    return { ...base, ...overrides };
  };

  it('renders a valid markdown document with header', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('# MyDesignSystem');
    expect(result).toContain('Generated by Documint');
  });

  it('includes all foundations sections', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('## Foundations');
    expect(result).toContain('### Colors (1)');
    expect(result).toContain('### Typography (1)');
    expect(result).toContain('### Spacing (1)');
    expect(result).toContain('### Grids (1)');
  });

  it('renders color table with tokens', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('color/primary');
    expect(result).toContain('#0066CC');
  });

  it('renders typography table', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('type/body');
    expect(result).toContain('Inter');
    expect(result).toContain('16px');
  });

  it('includes components section with details', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('## Components (1)');
    expect(result).toContain('### Button · Actions');
    expect(result).toContain('Primary action button');
  });

  it('renders component variant information', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('#### Variants');
    expect(result).toContain('size');
  });

  it('renders health report section', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('## Health Report');
    expect(result).toContain('**Overall Score:** 85/100');
    expect(result).toContain('Foundations');
    expect(result).toContain('Components');
  });

  it('includes warnings in health section', () => {
    const manifest = createFixture();
    const result = renderMarkdown(manifest);

    expect(result).toContain('### Warnings');
    expect(result).toContain('Missing documentation');
  });

  it('handles empty foundations gracefully', () => {
    const manifest = createFixture({
      domains: {
        ...createFixture().domains,
        foundations: {
          colors: [],
          typography: [],
          spacing: [],
          grids: [],
        },
      },
    });

    const result = renderMarkdown(manifest);
    expect(result).not.toContain('### Colors');
    expect(result).toContain('## Components');
  });

  it('handles empty components gracefully', () => {
    const manifest = createFixture({
      domains: {
        ...createFixture().domains,
        components: { components: [] },
      },
    });

    const result = renderMarkdown(manifest);
    expect(result).not.toContain('## Components');
    expect(result).toContain('## Health Report');
  });

  it('formats score values correctly', () => {
    const manifest = createFixture({
      domains: {
        ...createFixture().domains,
        health: {
          ...createFixture().domains.health,
          overallScore: 42,
          breakdown: {
            foundationsScore: 50,
            componentsScore: 40,
            tokenCoverageScore: 35,
            namingConsistencyScore: 45,
          },
        },
      },
    });

    const result = renderMarkdown(manifest);
    expect(result).toContain('**Overall Score:** 42/100');
    expect(result).toContain('| Foundations | 50 |');
  });
});
