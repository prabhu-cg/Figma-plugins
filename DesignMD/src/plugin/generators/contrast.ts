/**
 * Deterministic WCAG 2.1 contrast-ratio checking over the color tokens already
 * present in the DesignSystem schema. No AI, no network — just the standard
 * relative-luminance formula (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance)
 * applied to every resolvable, opaque color token.
 *
 * Figma doesn't record "this text color sits on that background" pairings, so
 * foreground/background roles are inferred from naming conventions and, for
 * Variables, their `scopes` (TEXT_FILL vs FRAME_FILL/SHAPE_FILL). When no
 * tokens can be classified either way, every opaque color is instead checked
 * against pure white and pure black so the report still produces something
 * actionable.
 */
import type { ColorValue, DesignSystem, VariableToken } from '@shared/types';

export interface ContrastColorToken {
  name: string;
  cssName: string;
  color: ColorValue;
}

export interface ContrastPair {
  foreground: ContrastColorToken;
  background: ContrastColorToken;
  ratio: number;
  passesAANormal: boolean;
  passesAALarge: boolean;
}

export interface FallbackContrastCheck {
  token: ContrastColorToken;
  ratioOnWhite: number;
  ratioOnBlack: number;
  passesOnWhite: boolean;
  passesOnBlack: boolean;
}

export interface ContrastReport {
  /** Foreground x background pairs, only populated when both roles could be inferred. */
  pairs: ContrastPair[];
  /** Used instead of `pairs` when no foreground/background roles could be inferred. */
  fallbackChecks: FallbackContrastCheck[];
  totalColorTokensChecked: number;
  skippedTranslucentCount: number;
}

const AA_NORMAL_MIN_RATIO = 4.5;
const AA_LARGE_MIN_RATIO = 3;
const WHITE: ColorValue = { hex: '#ffffff', r: 1, g: 1, b: 1, a: 1 };
const BLACK: ColorValue = { hex: '#000000', r: 0, g: 0, b: 0, a: 1 };

const FOREGROUND_HINTS = ['text', 'content', 'foreground', 'label', 'icon', 'on-', 'on_'];
const BACKGROUND_HINTS = ['background', 'surface', 'bg', 'fill', 'container', 'canvas', 'backdrop'];
const FOREGROUND_SCOPES = ['TEXT_FILL'];
const BACKGROUND_SCOPES = ['FRAME_FILL', 'SHAPE_FILL'];

function nameHasHint(name: string, hints: string[]): boolean {
  const lower = name.toLowerCase();
  return hints.some((hint) => lower.includes(hint));
}

type ColorRole = 'foreground' | 'background' | 'unknown';

function classifyColorRole(name: string, scopes: string[]): ColorRole {
  if (scopes.some((s) => FOREGROUND_SCOPES.includes(s)) || nameHasHint(name, FOREGROUND_HINTS)) {
    return 'foreground';
  }
  if (scopes.some((s) => BACKGROUND_SCOPES.includes(s)) || nameHasHint(name, BACKGROUND_HINTS)) {
    return 'background';
  }
  return 'unknown';
}

/** WCAG relative luminance for an sRGB color whose channels are 0-1 floats. */
export function relativeLuminance(color: ColorValue): number {
  const linearize = (channel: number) =>
    channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  const r = linearize(color.r);
  const g = linearize(color.g);
  const b = linearize(color.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two opaque sRGB colors, from 1 (no contrast) to 21 (black/white). */
export function contrastRatio(a: ColorValue, b: ColorValue): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function resolveVariableColor(
  variable: VariableToken,
  variablesById: Map<string, VariableToken>,
  depth = 0,
): ColorValue | null {
  if (depth > 10) return null;
  const value = variable.valuesByMode[0]?.value;
  if (!value) return null;
  if (value.kind === 'color') return value.color;
  if (value.kind === 'alias') {
    const next = variablesById.get(value.variableId);
    if (!next) return null;
    return resolveVariableColor(next, variablesById, depth + 1);
  }
  return null;
}

function collectColorTokens(ds: DesignSystem): {
  tokens: Array<ContrastColorToken & { role: ColorRole }>;
  skippedTranslucentCount: number;
} {
  const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
  const tokens: Array<ContrastColorToken & { role: ColorRole }> = [];
  let skippedTranslucentCount = 0;
  const seenNames = new Set<string>();

  for (const v of ds.variables) {
    if (v.category !== 'color' && v.category !== 'semantic') continue;
    if (v.resolvedType !== 'COLOR') continue;
    const color = resolveVariableColor(v, variablesById);
    if (!color) continue;
    if (color.a < 0.999) {
      skippedTranslucentCount += 1;
      continue;
    }
    if (seenNames.has(v.name)) continue;
    seenNames.add(v.name);
    tokens.push({
      name: v.name,
      cssName: v.cssName,
      color,
      role: classifyColorRole(v.name, v.scopes),
    });
  }

  for (const s of ds.styles.color) {
    if (!s.paint || s.paintIsGradientOrImage) continue;
    if (seenNames.has(s.name)) continue;
    if (s.paint.a < 0.999) {
      skippedTranslucentCount += 1;
      continue;
    }
    seenNames.add(s.name);
    tokens.push({
      name: s.name,
      cssName: s.cssName,
      color: s.paint,
      role: classifyColorRole(s.name, []),
    });
  }

  return { tokens, skippedTranslucentCount };
}

export function computeContrastReport(ds: DesignSystem): ContrastReport {
  const { tokens, skippedTranslucentCount } = collectColorTokens(ds);
  const foregrounds = tokens.filter((t) => t.role === 'foreground');
  const backgrounds = tokens.filter((t) => t.role === 'background');

  if (foregrounds.length > 0 && backgrounds.length > 0) {
    const pairs: ContrastPair[] = [];
    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        if (foreground.name === background.name) continue;
        const ratio = contrastRatio(foreground.color, background.color);
        pairs.push({
          foreground,
          background,
          ratio,
          passesAANormal: ratio >= AA_NORMAL_MIN_RATIO,
          passesAALarge: ratio >= AA_LARGE_MIN_RATIO,
        });
      }
    }
    pairs.sort((a, b) => a.ratio - b.ratio);
    return {
      pairs,
      fallbackChecks: [],
      totalColorTokensChecked: tokens.length,
      skippedTranslucentCount,
    };
  }

  const fallbackChecks: FallbackContrastCheck[] = tokens
    .map((token) => {
      const ratioOnWhite = contrastRatio(token.color, WHITE);
      const ratioOnBlack = contrastRatio(token.color, BLACK);
      return {
        token,
        ratioOnWhite,
        ratioOnBlack,
        passesOnWhite: ratioOnWhite >= AA_NORMAL_MIN_RATIO,
        passesOnBlack: ratioOnBlack >= AA_NORMAL_MIN_RATIO,
      };
    })
    .sort(
      (a, b) => Math.max(b.ratioOnWhite, b.ratioOnBlack) - Math.max(a.ratioOnWhite, a.ratioOnBlack),
    );

  return {
    pairs: [],
    fallbackChecks,
    totalColorTokensChecked: tokens.length,
    skippedTranslucentCount,
  };
}
