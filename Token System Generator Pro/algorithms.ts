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

export function hslToRgb(h: number, s: number, l: number): RGB {
  if (s === 0) return { r: l, g: l, b: l };
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue2rgb(p, q, h + 1 / 3), g: hue2rgb(p, q, h), b: hue2rgb(p, q, h - 1 / 3) };
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

export function generateColorRamp(hex: string): Record<RampStop, RGB> {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

  const lightnessMap: Record<RampStop, number> = {
    50:  0.95, 100: 0.88, 200: 0.76, 300: 0.64, 400: 0.52,
    500: hsl.l,
    600: hsl.l * 0.78, 700: hsl.l * 0.58, 800: hsl.l * 0.40, 900: hsl.l * 0.24,
  };
  const satMap: Record<RampStop, number> = {
    50:  hsl.s * 0.30, 100: hsl.s * 0.45, 200: hsl.s * 0.60,
    300: hsl.s * 0.75, 400: hsl.s * 0.90, 500: hsl.s,
    600: Math.min(1, hsl.s * 1.05), 700: Math.min(1, hsl.s * 1.10),
    800: Math.min(1, hsl.s * 1.15), 900: Math.min(1, hsl.s * 1.20),
  };

  const result = {} as Record<RampStop, RGB>;
  for (const stop of RAMP_STOPS) {
    result[stop] = hslToRgb(hsl.h, satMap[stop], lightnessMap[stop]);
  }
  result[500] = rgb;
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

export interface TypeLevel { name: string; fontSize: number; lineHeight: number; letterSpacing: number; }

export function generateTypographyScale(fontBase: number, ratioKey: string): TypeLevel[] {
  const ratio = TS_RATIO[ratioKey] ?? 1.25;
  const levels = [
    { name: 'display-lg', step: 10, lh: 1.0,  ls: -0.05 },
    { name: 'display-md', step:  9, lh: 1.0,  ls: -0.05 },
    { name: 'display-sm', step:  8, lh: 1.05, ls: -0.04 },
    { name: 'h1',         step:  7, lh: 1.1,  ls: -0.03 },
    { name: 'h2',         step:  6, lh: 1.1,  ls: -0.03 },
    { name: 'h3',         step:  5, lh: 1.2,  ls: -0.02 },
    { name: 'h4',         step:  4, lh: 1.2,  ls: -0.02 },
    { name: 'h5',         step:  3, lh: 1.2,  ls:  0    },
    { name: 'h6',         step:  2, lh: 1.2,  ls:  0    },
    { name: 'body-lg',    step:  1, lh: 1.5,  ls:  0    },
    { name: 'body',       step:  0, lh: 1.5,  ls:  0    },
    { name: 'caption',    step: -1, lh: 1.4,  ls:  0.01 },
    { name: 'xs',         step: -2, lh: 1.4,  ls:  0.02 },
  ];
  return levels.map(({ name, step, lh, ls }) => ({
    name,
    fontSize:      Math.round(fontBase * Math.pow(ratio, step) / 4) * 4,
    lineHeight:    lh,
    letterSpacing: ls,
  }));
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
