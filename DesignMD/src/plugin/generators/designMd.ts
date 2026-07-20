import type { DesignSystem, VariableToken } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { joinSections, mdHeading, mdList, mdTable } from './markdown';

function defaultValueLabel(v: VariableToken): string {
  const first = v.valuesByMode[0]?.value;
  if (!first) return '—';
  switch (first.kind) {
    case 'color':
      return first.color.hex;
    case 'float':
      return String(first.value);
    case 'string':
      return first.value;
    case 'boolean':
      return String(first.value);
    case 'alias':
      return `→ ${first.variableName}`;
    default:
      return '—';
  }
}

function overviewSection(ds: DesignSystem): string {
  const { summary, metadata } = ds;
  const rows = [
    ['Source File', metadata.fileName],
    ['Generated', metadata.generatedAt],
    ['Variable Collections', String(summary.variableCollectionsCount)],
    ['Variables', String(summary.variablesCount)],
    ['Modes', String(summary.modesCount)],
    ['Components', String(summary.componentsCount)],
    ['Component Sets', String(summary.componentSetsCount)],
    ['Text Styles', String(summary.textStylesCount)],
    ['Color Styles', String(summary.colorStylesCount)],
    ['Effect Styles', String(summary.effectStylesCount)],
    ['Grid Styles', String(summary.gridStylesCount)],
  ];
  return joinSections([
    mdHeading(2, 'Overview'),
    'This document was generated automatically by **DesignMD** from a Figma design system. ' +
      "It is derived entirely from the file's Variables and Styles — no content below was generated or altered by AI.\n",
    mdTable(['Metric', 'Value'], rows),
  ]);
}

function collectionsSection(ds: DesignSystem): string {
  const rows = ds.collections.map((c) => [
    c.name,
    c.modes.map((m) => m.name).join(', ') || '—',
    String(c.variableIds.length),
  ]);
  return joinSections([
    mdHeading(2, 'Variable Collections'),
    mdTable(['Collection', 'Modes', 'Variable Count'], rows),
  ]);
}

function tokenSection(
  title: string,
  ds: DesignSystem,
  category: VariableToken['category'],
  fallbackNote: string,
): string {
  const variables = ds.variables.filter((v) => v.category === category);
  if (variables.length > 0) {
    const rows = variables.map((v) => [
      v.name,
      v.cssName,
      defaultValueLabel(v),
      v.collectionName,
      v.description || '—',
    ]);
    return joinSections([
      mdHeading(2, title),
      mdTable(['Token', 'CSS Variable', 'Value', 'Collection', 'Description'], rows),
    ]);
  }
  return joinSections([mdHeading(2, title), `_No ${category} variables found. ${fallbackNote}_\n`]);
}

function colorTokensSection(ds: DesignSystem): string {
  const variables = ds.variables.filter((v) => v.category === 'color');
  if (variables.length > 0) return tokenSection('Color Tokens', ds, 'color', '');

  const styles = ds.styles.color;
  if (styles.length === 0) {
    return joinSections([
      mdHeading(2, 'Color Tokens'),
      '_No color variables or color styles found._\n',
    ]);
  }
  const rows = styles.map((s) => [
    s.name,
    s.cssName,
    s.paint?.hex ?? (s.paintIsGradientOrImage ? 'gradient/image' : '—'),
    s.description || '—',
  ]);
  return joinSections([
    mdHeading(2, 'Color Tokens'),
    '_Falling back to Color Styles — no Color Variables were found in this file._\n',
    mdTable(['Style', 'CSS Variable', 'Value', 'Description'], rows),
  ]);
}

function typographyTokensSection(ds: DesignSystem): string {
  const variables = ds.variables.filter((v) => v.category === 'typography');
  if (variables.length > 0) return tokenSection('Typography Tokens', ds, 'typography', '');

  const styles = ds.styles.text;
  if (styles.length === 0) {
    return joinSections([
      mdHeading(2, 'Typography Tokens'),
      '_No typography variables or text styles found._\n',
    ]);
  }
  const rows = styles.map((s) => {
    const p = s.textProperties;
    return [
      s.name,
      s.cssName,
      p?.fontFamily ?? '—',
      p ? String(p.fontSize) : '—',
      p?.fontWeight !== undefined ? String(p.fontWeight) : '—',
      p?.lineHeight ?? '—',
    ];
  });
  return joinSections([
    mdHeading(2, 'Typography Tokens'),
    '_Falling back to Text Styles — no Typography Variables were found in this file._\n',
    mdTable(['Style', 'CSS Variable', 'Font', 'Size', 'Weight', 'Line Height'], rows),
  ]);
}

function spacingTokensSection(ds: DesignSystem): string {
  return tokenSection(
    'Spacing Tokens',
    ds,
    'spacing',
    'Spacing has no style-based fallback in Figma — define Spacing as Variables to document it here.',
  );
}

function effectTokensSection(ds: DesignSystem): string {
  const variables = ds.variables.filter((v) => v.category === 'effect');
  if (variables.length > 0) return tokenSection('Effect Tokens', ds, 'effect', '');

  const styles = ds.styles.effect;
  if (styles.length === 0) {
    return joinSections([
      mdHeading(2, 'Effect Tokens'),
      '_No effect variables or effect styles found._\n',
    ]);
  }
  const rows = styles.map((s) => [
    s.name,
    s.cssName,
    (s.effects ?? []).map((e) => e.type).join(', ') || '—',
    s.description || '—',
  ]);
  return joinSections([
    mdHeading(2, 'Effect Tokens'),
    '_Falling back to Effect Styles — no Effect Variables were found in this file._\n',
    mdTable(['Style', 'CSS Variable', 'Effects', 'Description'], rows),
  ]);
}

function gridTokensSection(ds: DesignSystem): string {
  const styles = ds.styles.grid;
  if (styles.length === 0) {
    return joinSections([mdHeading(2, 'Grid Tokens'), '_No grid styles found._\n']);
  }
  const rows = styles.map((s) => [
    s.name,
    s.cssName,
    (s.grids ?? []).map((g) => g.pattern).join(', ') || '—',
    s.description || '—',
  ]);
  return joinSections([
    mdHeading(2, 'Grid Tokens'),
    mdTable(['Style', 'CSS Variable', 'Pattern', 'Description'], rows),
  ]);
}

function componentsByPageSection(ds: DesignSystem): string {
  const countsByPage = new Map<string, number>();
  for (const c of ds.components) {
    const count = c.isComponentSet ? c.variants.length : 1;
    countsByPage.set(c.pageName, (countsByPage.get(c.pageName) ?? 0) + count);
  }
  const rows = Array.from(countsByPage.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([page, count]) => [page, String(count)]);

  return joinSections([
    mdHeading(3, 'Components by Page'),
    'Full document scan, including any draft, playground, or example pages — not just pages ' +
      "intended for publishing. Compare against Figma's own library/publish count if this " +
      'total looks higher than expected.\n',
    mdTable(['Page', 'Component Count'], rows),
  ]);
}

function componentsSection(ds: DesignSystem): string {
  if (ds.components.length === 0) {
    return joinSections([
      mdHeading(2, 'Components'),
      '_No components or component sets found in this file._\n',
    ]);
  }
  const rows = ds.components.map((c) => [
    c.name,
    c.isComponentSet ? 'Component Set' : 'Component',
    c.pageName,
    String(c.variants.length),
    c.states.join(', ') || '—',
    c.sizes.join(', ') || '—',
    `[${c.name}.md](./components/${c.name.replace(/[\\/:*?"<>|]+/g, '-')}.md)`,
  ]);
  return joinSections([
    mdHeading(2, 'Components'),
    'Full per-component documentation lives in `/components`. See individual files for variants, properties, and token references.\n',
    componentsByPageSection(ds),
    mdHeading(3, 'All Components'),
    mdTable(['Component', 'Type', 'Page', 'Variants', 'States', 'Sizes', 'Docs'], rows),
  ]);
}

function formatUsedBy(names: string[], max = 5): string {
  if (names.length === 0) return '—';
  if (names.length <= max) return names.join(', ');
  return `${names.slice(0, max).join(', ')}, +${names.length - max} more`;
}

function tokenUsageSection(ds: DesignSystem): string {
  if (ds.variables.length === 0) {
    return joinSections([
      mdHeading(2, 'Token Usage'),
      '_No variables to cross-reference against components._\n',
    ]);
  }

  const used = ds.variables.filter((v) => v.usedByComponents.length > 0);
  const unused = ds.variables.filter((v) => v.usedByComponents.length === 0);
  const percent = Math.round((used.length / ds.variables.length) * 100);

  const usedRows = [...used]
    .sort((a, b) => b.usedByComponents.length - a.usedByComponents.length)
    .map((v) => [v.name, v.cssName, String(v.usedByComponents.length), formatUsedBy(v.usedByComponents)]);

  const unusedTable =
    unused.length === 0
      ? '_Every variable is referenced by at least one component._\n'
      : mdTable(
          ['Token', 'CSS Variable', 'Category', 'Collection'],
          unused.map((v) => [v.name, v.cssName, v.category, v.collectionName]),
        );

  return joinSections([
    mdHeading(2, 'Token Usage'),
    `${used.length} of ${ds.variables.length} variables (${percent}%) are referenced by at least one ` +
      "component in this file. Usage is derived from bound variables detected in each component's node " +
      'tree — Style bindings applied directly to nodes (not via Variables) are not tracked here.\n',
    mdHeading(3, 'Referenced Variables'),
    mdTable(['Token', 'CSS Variable', 'Used By', 'Components'], usedRows),
    mdHeading(3, 'Unused Variables'),
    unusedTable,
  ]);
}

function accessibilitySection(ds: DesignSystem): string {
  const smallTextStyles = ds.styles.text.filter(
    (s) => (s.textProperties?.fontSize ?? 0) > 0 && (s.textProperties?.fontSize ?? 100) < 12,
  );
  const undocumentedColors = [
    ...ds.variables.filter((v) => v.category === 'color' && !v.description),
    ...ds.styles.color.filter((s) => !s.description),
  ];

  const notes: string[] = [
    'This section lists deterministic, rule-based checks only — it does not perform AI or contrast-ratio analysis.',
  ];
  if (smallTextStyles.length > 0) {
    notes.push(
      `${smallTextStyles.length} text style(s) are set below 12px, which may fail legibility guidelines: ${smallTextStyles
        .map((s) => s.name)
        .join(', ')}.`,
    );
  }
  if (undocumentedColors.length > 0) {
    notes.push(
      `${undocumentedColors.length} color token(s) have no description — consider documenting intended usage and contrast pairing.`,
    );
  }
  notes.push(
    'Verify color contrast against WCAG 2.1 AA (4.5:1 for body text, 3:1 for large text) using your own contrast tooling before shipping.',
  );

  return joinSections([mdHeading(2, 'Accessibility Notes'), mdList(notes)]);
}

function namingConventionsSection(ds: DesignSystem): string {
  const allNames = [
    ...ds.variables.map((v) => v.name),
    ...Object.values(ds.styles)
      .flat()
      .map((s) => s.name),
  ];
  const slashDelimited = allNames.filter((n) => n.includes('/')).length;
  const dashDelimited = allNames.filter((n) => n.includes('-')).length;
  const camelCase = allNames.filter((n) => /[a-z][A-Z]/.test(n)).length;

  const dominant =
    slashDelimited >= dashDelimited && slashDelimited >= camelCase
      ? 'slash-delimited hierarchical naming (e.g. `Color/Primary/500`)'
      : dashDelimited >= camelCase
        ? 'kebab-case naming (e.g. `color-primary-500`)'
        : 'camelCase naming (e.g. `colorPrimary500`)';

  return joinSections([
    mdHeading(2, 'Naming Conventions'),
    `Detected source naming pattern: **${dominant}** (${allNames.length} names scanned).\n`,
    'All generated CSS custom properties are normalized to kebab-case with a `--` prefix (e.g. `--color-primary-500`), regardless of the source naming style, so downstream code has one consistent convention.\n',
  ]);
}

function designPrinciplesSection(): string {
  return joinSections([
    mdHeading(2, 'Design Principles'),
    '_DesignMD does not invent design principles — this file only documents what already exists in Figma. ' +
      "Add your team's principles here (e.g. consistency, accessibility, clarity, scalability) so this file stays the single source of truth for both design intent and tokens._\n",
  ]);
}

export function generateDesignMd(ds: DesignSystem): GeneratedFile {
  const content = joinSections([
    mdHeading(1, 'Design System'),
    overviewSection(ds),
    collectionsSection(ds),
    colorTokensSection(ds),
    typographyTokensSection(ds),
    spacingTokensSection(ds),
    effectTokensSection(ds),
    gridTokensSection(ds),
    componentsSection(ds),
    tokenUsageSection(ds),
    accessibilitySection(ds),
    namingConventionsSection(ds),
    designPrinciplesSection(),
  ]);

  return { path: 'design.md', content };
}
