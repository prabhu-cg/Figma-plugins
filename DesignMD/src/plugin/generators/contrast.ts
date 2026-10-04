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
import { nameHasHint } from '@shared/naming';
import { defaultModeValue } from './tokenValue';
import type { ColorValue, ContrastPairSpec, DesignSystem, VariableToken } from '@shared/types';

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
  /**
   * Lowest-contrast foreground x background pairs (worst first), capped at MAX_REPORTED_PAIRS.
   * Only populated when both roles could be inferred; the totals below cover every pair.
   */
  pairs: ContrastPair[];
  totalPairs: number;
  passingNormalCount: number;
  failingLargeCount: number;
  /** Used instead of `pairs` when no foreground/background roles could be inferred. */
  fallbackChecks: FallbackContrastCheck[];
  totalColorTokensChecked: number;
  skippedTranslucentCount: number;
}

/** Foreground x background is a cross product; keep only the worst pairs so large systems stay cheap. */
export const MAX_REPORTED_PAIRS = 500;
const AA_NORMAL_MIN_RATIO = 4.5;
const AA_LARGE_MIN_RATIO = 3;
const WHITE: ColorValue = { hex: '#ffffff', r: 1, g: 1, b: 1, a: 1 };
const BLACK: ColorValue = { hex: '#000000', r: 0, g: 0, b: 0, a: 1 };

const FOREGROUND_HINTS = ['text', 'content', 'foreground', 'fg', 'label', 'icon', 'on'];
const BACKGROUND_HINTS = ['background', 'surface', 'bg', 'fill', 'container', 'canvas', 'backdrop'];
const FOREGROUND_SCOPES = ['TEXT_FILL'];
const BACKGROUND_SCOPES = ['FRAME_FILL', 'SHAPE_FILL'];

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

/**
 * The value a variable has in the named mode, falling back to its default mode when it has no
 * mode of that name (e.g. a variable from a collection that only defines "Mode 1").
 */
function valueForMode(variable: VariableToken, modeName: string | undefined) {
  if (modeName !== undefined) {
    const match = variable.valuesByMode.find((m) => m.modeName === modeName);
    if (match) return match.value;
  }
  return defaultModeValue(variable);
}

function resolveVariableColor(
  variable: VariableToken,
  variablesById: Map<string, VariableToken>,
  modeName: string | undefined,
  depth = 0,
): ColorValue | null {
  if (depth > 10) return null;
  const value = valueForMode(variable, modeName);
  if (!value) return null;
  if (value.kind === 'color') return value.color;
  if (value.kind === 'alias') {
    const next = variablesById.get(value.variableId);
    if (!next) return null;
    return resolveVariableColor(next, variablesById, modeName, depth + 1);
  }
  return null;
}

function collectColorTokens(
  ds: DesignSystem,
  modeName: string | undefined,
): {
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
    const color = resolveVariableColor(v, variablesById, modeName);
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

/**
 * Mode names that color variables define, default mode of the first collection first. Contrast
 * can differ completely between e.g. Light and Dark, so each is checked on its own.
 */
export function colorModeNames(ds: DesignSystem): string[] {
  const names: string[] = [];
  for (const v of ds.variables) {
    if (v.resolvedType !== 'COLOR') continue;
    if (v.category !== 'color' && v.category !== 'semantic') continue;
    for (const m of v.valuesByMode) {
      if (!names.includes(m.modeName)) names.push(m.modeName);
    }
  }
  return names;
}

export interface ModeContrastReport {
  /** Null when the file has no color variables with modes (styles only). */
  modeName: string | null;
  report: ContrastReport;
}

/** One report per color mode; a single report when there is at most one mode. */
export function computeContrastReportsByMode(ds: DesignSystem): ModeContrastReport[] {
  const modes = colorModeNames(ds);
  if (modes.length <= 1) {
    return [{ modeName: modes[0] ?? null, report: computeContrastReport(ds, modes[0]) }];
  }
  return modes.map((modeName) => ({ modeName, report: computeContrastReport(ds, modeName) }));
}

/** Contrast report for one mode (the default mode when `modeName` is omitted). */
export function computeContrastReport(ds: DesignSystem, modeName?: string): ContrastReport {
  const { tokens, skippedTranslucentCount } = collectColorTokens(ds, modeName);
  const foregrounds = tokens.filter((t) => t.role === 'foreground');
  const backgrounds = tokens.filter((t) => t.role === 'background');

  if (foregrounds.length > 0 && backgrounds.length > 0) {
    let kept: ContrastPair[] = [];
    let cutoff = Infinity;
    let totalPairs = 0;
    let passingNormalCount = 0;
    let failingLargeCount = 0;

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        if (foreground.name === background.name) continue;
        const ratio = contrastRatio(foreground.color, background.color);
        totalPairs += 1;
        if (ratio >= AA_NORMAL_MIN_RATIO) passingNormalCount += 1;
        if (ratio < AA_LARGE_MIN_RATIO) failingLargeCount += 1;
        if (ratio >= cutoff) continue;
        kept.push({
          foreground,
          background,
          ratio,
          passesAANormal: ratio >= AA_NORMAL_MIN_RATIO,
          passesAALarge: ratio >= AA_LARGE_MIN_RATIO,
        });
        if (kept.length >= MAX_REPORTED_PAIRS * 4) {
          kept.sort((a, b) => a.ratio - b.ratio);
          kept = kept.slice(0, MAX_REPORTED_PAIRS);
          cutoff = kept[kept.length - 1].ratio;
        }
      }
    }

    kept.sort((a, b) => a.ratio - b.ratio);
    return {
      pairs: kept.slice(0, MAX_REPORTED_PAIRS),
      totalPairs,
      passingNormalCount,
      failingLargeCount,
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
    totalPairs: 0,
    passingNormalCount: 0,
    failingLargeCount: 0,
    fallbackChecks,
    totalColorTokensChecked: tokens.length,
    skippedTranslucentCount,
  };
}

/** Names of color tokens that can be used in a contrast pair: color variables and solid color styles. */
export function listColorTokenNames(ds: DesignSystem): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const add = (name: string) => {
    if (!seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  };
  for (const v of ds.variables) {
    if (v.resolvedType === 'COLOR' && (v.category === 'color' || v.category === 'semantic')) {
      add(v.name);
    }
  }
  for (const s of ds.styles.color) {
    if (s.paint && !s.paintIsGradientOrImage) add(s.name);
  }
  return names;
}

export type DefinedPairStatus = 'ok' | 'missing' | 'translucent';

export interface DefinedPairResult {
  spec: ContrastPairSpec;
  status: DefinedPairStatus;
  ratio?: number;
  passesAANormal?: boolean;
  passesAALarge?: boolean;
}

/**
 * Contrast for pairs the user chose explicitly, in one mode. Unlike inferred pairs these are
 * never dropped silently: a token that no longer exists or is translucent is reported as such.
 */
export function computeDefinedPairs(
  ds: DesignSystem,
  specs: readonly ContrastPairSpec[],
  modeName?: string,
): DefinedPairResult[] {
  const variablesById = new Map(ds.variables.map((v) => [v.id, v]));
  const colors = new Map<string, ColorValue>();
  for (const s of ds.styles.color) {
    if (s.paint && !s.paintIsGradientOrImage) colors.set(s.name, s.paint);
  }
  // Variables win over styles with the same name, like everywhere else.
  for (const v of ds.variables) {
    if (v.resolvedType !== 'COLOR') continue;
    const color = resolveVariableColor(v, variablesById, modeName);
    if (color) colors.set(v.name, color);
  }

  return specs.map((spec) => {
    const foreground = colors.get(spec.foreground);
    const background = colors.get(spec.background);
    if (!foreground || !background) return { spec, status: 'missing' };
    if (foreground.a < 0.999 || background.a < 0.999) return { spec, status: 'translucent' };
    const ratio = contrastRatio(foreground, background);
    return {
      spec,
      status: 'ok',
      ratio,
      passesAANormal: ratio >= AA_NORMAL_MIN_RATIO,
      passesAALarge: ratio >= AA_LARGE_MIN_RATIO,
    };
  });
}
