// Pure color / scale algorithms. No Figma API usage, so they can be unit-tested in Node.

export interface RGB { readonly r: number; readonly g: number; readonly b: number }

export function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

// ─── OKLCH ───────────────────────────────────────────────────────
// OKLab/OKLCH (Björn Ottosson, 2020) is perceptually uniform: equal lightness steps look equal
// across every hue, and changing hue or chroma doesn't shift perceived lightness the way HSL does.

export interface Oklch { l: number; c: number; h: number } // l 0–1, c ≈ 0–0.4, h in degrees

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearToSrgb(v: number): number {
  return v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  const c = Math.sqrt(A * A + B * B);
  const h = c < 1e-6 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

// Linear-light sRGB for an OKLCH color; components fall outside 0–1 when it is out of gamut.
function oklchToLinear(l: number, c: number, h: number): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const A = c * Math.cos(hr), B = c * Math.sin(hr);
  const l_ = Math.pow(l + 0.3963377774 * A + 0.2158037573 * B, 3);
  const m_ = Math.pow(l - 0.1055613458 * A - 0.0638541728 * B, 3);
  const s_ = Math.pow(l - 0.0894841775 * A - 1.2914855480 * B, 3);
  return [
     4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_,
  ];
}

const GAMUT_EPS = 1e-4;
function inSrgbGamut(rgb: [number, number, number]): boolean {
  return rgb.every(v => v >= -GAMUT_EPS && v <= 1 + GAMUT_EPS);
}

// Convert to sRGB. A color outside the gamut keeps its lightness and hue and loses only
// as much chroma as it must, rather than being clipped per channel (which shifts the hue).
export function oklchToRgb(l: number, c: number, h: number): RGB {
  let lin = oklchToLinear(l, c, h);
  if (!inSrgbGamut(lin)) {
    let lo = 0, hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inSrgbGamut(oklchToLinear(l, mid, h))) lo = mid; else hi = mid;
    }
    lin = oklchToLinear(l, lo, h);
  }
  const clamp = (v: number) => Math.min(1, Math.max(0, linearToSrgb(Math.min(1, Math.max(0, v)))));
  return { r: clamp(lin[0]), g: clamp(lin[1]), b: clamp(lin[2]) };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

export const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
export type RampStop = typeof RAMP_STOPS[number];

export const STARTER_COLORS = {
  primary:   '#3D6BE8',
  secondary: '#7C3AED',
  tertiary:  '#0891B2',
  accent:    '#EA580C',
  info:      '#3B82F6',
  success:   '#22C55E',
  error:     '#EF4444',
  warning:   '#F59E0B',
  neutral:   '#6B7280',
} as const;

// How far each stop sits from stop 500 toward the lightest (50) or darkest (900) end, 0–1.
// Lightness is interpolated in OKLCH, so each step is an equal perceptual distance.
const LIGHT_SIDE: Partial<Record<RampStop, number>> = { 400: 0.25, 300: 0.50, 200: 0.72, 100: 0.88, 50: 1 };
const DARK_SIDE:  Partial<Record<RampStop, number>> = { 600: 0.22, 700: 0.45, 800: 0.70, 900: 1 };
const RAMP_L_MAX = 0.97;
const RAMP_L_MIN = 0.24;

// Chroma relative to the input color: full at 500, easing off toward both ends so tints stay
// soft and shades stay rich instead of going neon or muddy.
const CHROMA_CURVE: Record<RampStop, number> = {
  50: 0.15, 100: 0.30, 200: 0.55, 300: 0.78, 400: 0.92, 500: 1,
  600: 0.95, 700: 0.82, 800: 0.65, 900: 0.50,
};

// Stop 500 is exactly the input color. The other stops keep its hue and move only lightness
// and chroma. Stops whose chroma doesn't fit in sRGB are gamut-mapped by reducing chroma.
export function generateColorRamp(hex: string): Record<RampStop, RGB> {
  const rgb = hexToRgb(hex);
  const base = rgbToOklch(rgb.r, rgb.g, rgb.b);
  const achromatic = base.c < 0.004;
  const top = Math.max(RAMP_L_MAX, base.l);
  const bottom = Math.min(RAMP_L_MIN, base.l);

  const result = {} as Record<RampStop, RGB>;
  for (const stop of RAMP_STOPS) {
    if (stop === 500) { result[stop] = rgb; continue; }
    const light = LIGHT_SIDE[stop];
    const l = light !== undefined
      ? base.l + (top - base.l) * light
      : base.l - (base.l - bottom) * (DARK_SIDE[stop] as number);
    result[stop] = oklchToRgb(l, achromatic ? 0 : base.c * CHROMA_CURVE[stop], base.h);
  }
  return result;
}

// ─── TYPOGRAPHY SCALE ─────────────────────────────────────────────

export const TS_RATIO: Record<string, number> = {
  'major-second':   1.125,
  'minor-third':    1.200,
  'major-third':    1.250,
  'perfect-fourth': 1.333,
  'aug-fourth':     1.414,
};

export interface TypeLevel {
  name: string;
  fontSize: number;
  lineHeight: number;      // ratio of font size
  letterSpacing: number;   // ratio of font size (em)
  paragraphSpacing: number; // px, on the 4pt grid
  fontWeight: number;      // 100–900
}

// Weights read as a hierarchy: displays and the top headings are bold, the smaller headings
// semibold, running text regular. Paragraph spacing is a share of the font size: none for
// display lines (one line each), more for body copy where paragraphs stack.
export function generateTypographyScale(fontBase: number, ratioKey: string): TypeLevel[] {
  const ratio = Object.prototype.hasOwnProperty.call(TS_RATIO, ratioKey) ? TS_RATIO[ratioKey] : 1.25;
  const levels = [
    { name: 'display-lg', step: 10, lh: 1.0,  ls: -0.05, ps: 0,    fw: 700 },
    { name: 'display-md', step:  9, lh: 1.0,  ls: -0.05, ps: 0,    fw: 700 },
    { name: 'display-sm', step:  8, lh: 1.05, ls: -0.04, ps: 0,    fw: 700 },
    { name: 'h1',         step:  7, lh: 1.1,  ls: -0.03, ps: 0.25, fw: 700 },
    { name: 'h2',         step:  6, lh: 1.1,  ls: -0.03, ps: 0.25, fw: 700 },
    { name: 'h3',         step:  5, lh: 1.2,  ls: -0.02, ps: 0.5,  fw: 600 },
    { name: 'h4',         step:  4, lh: 1.2,  ls: -0.02, ps: 0.5,  fw: 600 },
    { name: 'h5',         step:  3, lh: 1.2,  ls:  0,    ps: 0.5,  fw: 600 },
    { name: 'h6',         step:  2, lh: 1.2,  ls:  0,    ps: 0.5,  fw: 600 },
    { name: 'body-lg',    step:  1, lh: 1.5,  ls:  0,    ps: 0.75, fw: 400 },
    { name: 'body',       step:  0, lh: 1.5,  ls:  0,    ps: 0.75, fw: 400 },
    { name: 'caption',    step: -1, lh: 1.4,  ls:  0.01, ps: 0.5,  fw: 400 },
    { name: 'xs',         step: -2, lh: 1.4,  ls:  0.02, ps: 0.5,  fw: 400 },
  ];
  return levels.map(({ name, step, lh, ls, ps, fw }) => {
    const fontSize = Math.round(fontBase * Math.pow(ratio, step) / 4) * 4;
    return {
      name,
      fontSize,
      lineHeight:       lh,
      letterSpacing:    ls,
      paragraphSpacing: Math.round(fontSize * ps / 4) * 4,
      fontWeight:       fw,
    };
  });
}

// ─── FONT WEIGHTS ─────────────────────────────────────────────────
// Fonts report styles by name ("Semi Bold", "Demi", "Heavy"), not by number, so names are mapped
// to the usual 100–900 weights. Italic styles are left out: text styles here are upright.

export const FONT_WEIGHT_NAMES: Record<number, string> = {
  100: 'thin', 200: 'extra-light', 300: 'light', 400: 'regular', 500: 'medium',
  600: 'semibold', 700: 'bold', 800: 'extra-bold', 900: 'black',
};

// Order matters: "extrabold" must be tested before "bold", "semibold" before "bold", etc.
const STYLE_WEIGHT_PATTERNS: [RegExp, number][] = [
  [/(extra|ultra)bold/, 800], [/(semi|demi)bold|^demi$/, 600], [/(extra|ultra)light/, 200],
  [/^(thin|hairline)$/, 100], [/^light$/, 300], [/^medium$/, 500], [/^bold$/, 700],
  [/^(black|heavy)$/, 900], [/^(regular|book|normal|roman)$/, 400],
];

export function weightFromStyleName(style: string): number | null {
  const s = style.toLowerCase().replace(/[\s_-]+/g, '');
  if (s.includes('italic') || s.includes('oblique')) return null;
  for (const [pattern, weight] of STYLE_WEIGHT_PATTERNS) if (pattern.test(s)) return weight;
  return null;
}

// The style of a font's available styles closest to a wanted weight (exact match preferred;
// on a tie the heavier one wins). null when the font has no upright style we can place.
export function pickFontStyle(weight: number, styles: string[]): { style: string; weight: number; exact: boolean } | null {
  let best: { style: string; weight: number; exact: boolean } | null = null;
  for (const style of styles) {
    const w = weightFromStyleName(style);
    if (w === null) continue;
    const better = best === null
      || Math.abs(w - weight) < Math.abs(best.weight - weight)
      || (Math.abs(w - weight) === Math.abs(best.weight - weight) && w > best.weight);
    if (better) best = { style, weight: w, exact: w === weight };
  }
  return best;
}

export const SPACING_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

export function generateSpacingScale(base: number): Record<string, number> {
  const scale: Record<string, number> = {};
  for (const m of SPACING_MULTIPLIERS) scale[String(base * m)] = base * m;
  return scale;
}

export function generateRadiusScale(base: number): Record<string, number> {
  return {
    none: 0,
    sm:   Math.max(1, Math.round(base / 2)),
    md:   base,
    lg:   base * 2,
    xl:   base * 4,
    '2xl': base * 6,
    full: 9999,
  };
}

export function generateBorderWidthScale(base: number): Record<string, number> {
  return { none: 0, sm: base, md: base * 2, lg: base * 4, xl: base * 8 };
}

// Names never overlap with the semantic reserved words: blue, green, red, amber, grey.
export function getColorName(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const hDeg = h * 360;
  const sPct = s * 100;
  const lPct = l * 100;

  if (sPct < 8) return lPct >= 70 ? 'silver' : 'charcoal';

  let base: string;
  if      (hDeg < 14 || hDeg >= 348) base = 'crimson';
  else if (hDeg < 24)                 base = 'scarlet';
  else if (hDeg < 36)                 base = 'coral';
  else if (hDeg < 47)                 base = 'orange';
  else if (hDeg < 57)                 base = 'gold';
  else if (hDeg < 69)                 base = 'saffron';
  else if (hDeg < 82)                 base = 'yellow';
  else if (hDeg < 94)                 base = 'lime';
  else if (hDeg < 130)               base = 'emerald';
  else if (hDeg < 148)               base = 'jade';
  else if (hDeg < 163)               base = 'teal';
  else if (hDeg < 180)               base = 'turquoise';
  else if (hDeg < 200)               base = 'aqua';
  else if (hDeg < 218)               base = 'sky';
  else if (hDeg < 244)               base = 'cobalt';
  else if (hDeg < 262)               base = 'indigo';
  else if (hDeg < 280)               base = 'violet';
  else if (hDeg < 300)               base = 'purple';
  else if (hDeg < 320)               base = 'fuchsia';
  else if (hDeg < 336)               base = 'rose';
  else                               base = 'ruby';

  if      (lPct <= 22) return `deep-${base}`;
  else if (lPct >= 80) return `pale-${base}`;
  else if (sPct <  28) return `muted-${base}`;
  return base;
}

// ─── HELPERS ─────────────────────────────────────────────────────
