import type { DesignSystem, VariableToken } from '@shared/types';
import { joinSections, mdHeading, mdTable } from '../markdown';
import { defaultModeValue, primitiveValue } from '../tokenValue';

function defaultValueLabel(v: VariableToken): string {
  const first = defaultModeValue(v);
  if (!first) return '—';
  if (first.kind === 'alias') return `→ ${first.variableName}`;
  const primitive = primitiveValue(first);
  return primitive === null ? '—' : String(primitive);
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

export function colorTokensSection(ds: DesignSystem): string {
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

export function typographyTokensSection(ds: DesignSystem): string {
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

export function spacingTokensSection(ds: DesignSystem): string {
  return tokenSection(
    'Spacing Tokens',
    ds,
    'spacing',
    'Spacing has no style-based fallback in Figma — define Spacing as Variables to document it here.',
  );
}

export function effectTokensSection(ds: DesignSystem): string {
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

export function gridTokensSection(ds: DesignSystem): string {
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
