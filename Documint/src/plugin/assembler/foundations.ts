import type {
  FoundationsSchema, ColorToken, TypographyToken, SpacingToken, GridToken,
  TokenSource, LineHeightUnit, TextCaseValue, TextDecorationValue,
  GridType, BreakpointHint,
} from '@/types/schemas';
import type { RawExtractionResult, RawGridStyle, RawVariable } from '@/types/raw';
import { contrastOnWhite, contrastOnBlack, meetsWCAG_AA, meetsWCAG_AAA } from '@/plugin/inference/wcag';
import { inferColorRole } from '@/plugin/inference/color-roles';
import { inferTypographyRole } from '@/plugin/inference/type-roles';
import { parseTokenName } from '@/plugin/inference/naming-parser';

export function buildColorToken(
  id: string,
  name: string,
  r: number,
  g: number,
  b: number,
  source: TokenSource,
  aliases: string[] = []
): ColorToken {
  const rgb = { r, g, b };
  const hex = `#${[r, g, b].map(v => v.toString(16).padStart(2, '0').toUpperCase()).join('')}`;
  const cow = contrastOnWhite(rgb);
  const cob = contrastOnBlack(rgb);
  const best = Math.max(cow, cob);
  const { label } = parseTokenName(name);

  let usageHint: string;
  if (cow >= 7)      usageHint = 'Suitable for body text on light backgrounds (AAA)';
  else if (cow >= 4.5) usageHint = 'Suitable for text on light backgrounds (AA)';
  else if (cob >= 7)   usageHint = 'Suitable for body text on dark backgrounds (AAA)';
  else if (cob >= 4.5) usageHint = 'Suitable for text on dark backgrounds (AA)';
  else                 usageHint = 'For decorative use — insufficient contrast for text';

  return {
    id, tokenName: name, label,
    value: { hex, rgb },
    semanticRole: inferColorRole(name),
    source, variableMode: null, aliases,
    contrastOnWhite: cow,
    contrastOnBlack: cob,
    wcagAA: meetsWCAG_AA(best),
    wcagAAA: meetsWCAG_AAA(best),
    usageHint,
  };
}

function fontStyleToWeight(style: string): number {
  const s = style.toLowerCase();
  if (s.includes('thin'))                                    return 100;
  if (s.includes('extralight') || s.includes('extra light')) return 200;
  if (s.includes('light'))                                   return 300;
  if (s.includes('medium'))                                  return 500;
  if (s.includes('semibold') || s.includes('semi bold') || s.includes('demi')) return 600;
  if (s.includes('extrabold') || s.includes('extra bold') || s.includes('heavy')) return 800;
  if (s.includes('black'))                                   return 900;
  if (s.includes('bold'))                                    return 700;
  return 400;
}

function mapLineHeightUnit(unit: string): LineHeightUnit {
  if (unit === 'PIXELS') return 'px';
  if (unit === 'PERCENT') return '%';
  return 'auto';
}

function mapTextCase(v: string): TextCaseValue {
  const map: Record<string, TextCaseValue> = { NONE: 'none', UPPER: 'uppercase', LOWER: 'lowercase', TITLE: 'capitalize' };
  return map[v] ?? 'none';
}

function mapTextDecoration(v: string): TextDecorationValue {
  const map: Record<string, TextDecorationValue> = { NONE: 'none', STRIKETHROUGH: 'strikethrough', UNDERLINE: 'underline' };
  return map[v] ?? 'none';
}

export function buildTypographyToken(
  id: string,
  name: string,
  fontFamily: string,
  fontStyle: string,
  fontSize: number,
  lineHeight: { value: number; unit: string },
  letterSpacing: { value: number; unit: string },
  textCase: string,
  textDecoration: string,
  source: TokenSource
): TypographyToken {
  const { label } = parseTokenName(name);
  return {
    id, tokenName: name, label,
    fontFamily,
    fontWeight: fontStyleToWeight(fontStyle),
    fontSize,
    lineHeight: { value: lineHeight.value, unit: mapLineHeightUnit(lineHeight.unit) },
    letterSpacing: { value: letterSpacing.value, unit: letterSpacing.unit === 'PERCENT' ? '%' : 'px' },
    textCase: mapTextCase(textCase),
    textDecoration: mapTextDecoration(textDecoration),
    role: inferTypographyRole(name),
    source, usageHint: '',
  };
}

export function buildSpacingToken(name: string, value: number): SpacingToken {
  const parsed = parseTokenName(name);
  const stepStr = parsed.scale || parsed.category;
  const scaleStep = parseInt(stepStr, 10) || 0;
  const scaleBase = scaleStep > 0 ? Math.round(value / scaleStep) : 0;
  return {
    tokenName: name,
    label: parsed.label,
    value, unit: 'px',
    scaleBase, scaleStep,
    usageHint: scaleStep > 0 ? `${scaleStep} × ${scaleBase}px base unit` : '',
  };
}

function inferBreakpointHint(name: string): BreakpointHint {
  const lower = name.toLowerCase();
  if (lower.includes('mobile') || lower.includes('sm')) return 'mobile';
  if (lower.includes('tablet') || lower.includes('md')) return 'tablet';
  if (lower.includes('desktop') || lower.includes('lg')) return 'desktop';
  if (lower.includes('wide') || lower.includes('xl'))   return 'wide';
  return 'unknown';
}

export function buildGridToken(
  name: string,
  pattern: string,
  count: number,
  gutterSize: number,
  margin: number,
  sectionSize: number
): GridToken {
  const { label } = parseTokenName(name);
  const typeMap: Record<string, GridType> = { COLUMNS: 'columns', ROWS: 'rows', GRID: 'grid' };
  return {
    tokenName: name, label,
    type: typeMap[pattern] ?? 'grid',
    count, gutter: gutterSize, margin, sectionSize,
    breakpointHint: inferBreakpointHint(name),
  };
}

export function assembleFoundations(raw: RawExtractionResult): FoundationsSchema {
  const colors: ColorToken[] = [];

  for (const s of raw.colorStyles) {
    const paint = (s.paints as any[])?.[0];
    if (!paint || paint.type !== 'SOLID' || !paint.color) continue;
    const { r, g, b } = paint.color;
    colors.push(buildColorToken(s.id, s.name, Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), 'style'));
  }

  for (const v of raw.colorVariables) {
    const entries = Object.entries(v.valuesByMode as Record<string, any>);
    const [, value] = entries[0] ?? [];
    if (!value || typeof value !== 'object' || (value as any).type === 'VARIABLE_ALIAS') continue;
    const val = value as any;
    if (!val.r || !val.g || !val.b) continue;
    colors.push(buildColorToken(v.id, v.name, Math.round(val.r * 255), Math.round(val.g * 255), Math.round(val.b * 255), 'variable'));
  }

  const typography: TypographyToken[] = raw.textStyles
    .filter(s => s.fontName && (s.fontName as any).family && (s.fontName as any).style)
    .map(s =>
      buildTypographyToken(
        s.id, s.name,
        (s.fontName as any).family,
        (s.fontName as any).style,
        s.fontSize,
        s.lineHeight as { value: number; unit: string },
        s.letterSpacing as { value: number; unit: string },
        s.textCase as string,
        s.textDecoration as string,
        'style'
      )
    );

  const spacing: SpacingToken[] = raw.spacingVariables
    .filter(v => v.valuesByMode && Object.keys(v.valuesByMode).length > 0)
    .map((v: RawVariable) => {
      const entries = Object.entries(v.valuesByMode as Record<string, any>);
      const [, value] = entries[0] ?? [];
      return buildSpacingToken(v.name, typeof value === 'number' ? value : 0);
    });

  const grids: GridToken[] = raw.gridStyles.flatMap((s: RawGridStyle) => {
    const grid = (s.grids as any[])[0];
    if (!grid) return [];
    return [buildGridToken(s.name, grid.pattern ?? 'COLUMNS', grid.count ?? 12, grid.gutterSize ?? 0, grid.offset ?? 0, grid.sectionSize ?? 0)];
  });

  return { colors, typography, spacing, grids };
}
