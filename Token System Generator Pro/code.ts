figma.showUI(__html__, { width: 560, height: 480 });

// ─── TYPES ───────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

interface ScratchColors {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
  info: string;
  success: string;
  error: string;
  warning: string;
  neutral: string;
}

// ─── PURE ALGORITHMS (keep in sync with tests/algorithms.test.js) ─

function hexToRgb(hex: string): RGB {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
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

function hslToRgb(h: number, s: number, l: number): RGB {
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

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
type RampStop = typeof RAMP_STOPS[number];

function generateColorRamp(hex: string): Record<RampStop, RGB> {
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

const SPACING_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

function generateSpacingScale(base: number): Record<string, number> {
  const scale: Record<string, number> = {};
  for (const m of SPACING_MULTIPLIERS) scale[String(base * m)] = base * m;
  return scale;
}

function generateRadiusScale(base: number): Record<string, number> {
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

// ─── HELPERS ─────────────────────────────────────────────────────

function createColor(
  collection: VariableCollection,
  name: string,
  r: number, g: number, b: number
): Variable {
  const v = figma.variables.createVariable(name, collection.id, 'COLOR');
  v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
  return v;
}

function createNumber(
  collection: VariableCollection,
  name: string,
  value: number
): Variable {
  const v = figma.variables.createVariable(name, collection.id, 'FLOAT');
  v.setValueForMode(collection.modes[0].modeId, value);
  return v;
}

function alias(
  collection: VariableCollection,
  name: string,
  ref: Variable | undefined
): Variable | undefined {
  if (!ref) return;
  const v = figma.variables.createVariable(name, collection.id, ref.resolvedType);
  v.setValueForMode(collection.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: ref.id });
  return v;
}

function deleteAllCollections(): void {
  const collections = figma.variables.getLocalVariableCollections();
  const vars = figma.variables.getLocalVariables();
  collections.forEach(col => {
    vars.forEach(v => {
      if (v.variableCollectionId === col.id) { try { v.remove(); } catch (_e) {} }
    });
    try { col.remove(); } catch (_e) {}
  });
}

function tokensExist(): boolean {
  return figma.variables.getLocalVariableCollections().length > 0;
}

// ─── EXISTING GENERATION (unchanged) ─────────────────────────────

function createStarterSystem(): void {
  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');

  const brand  = createColor(global, 'color/brand', 0.6, 0, 1);
  const white  = createColor(global, 'color/white', 1, 1, 1);
  const black  = createColor(global, 'color/black', 0.1, 0.1, 0.1);
  createNumber(global, 'spacing/16', 16);
  createNumber(global, 'borderRadius/md', 8);
  const fontSize = createNumber(global, 'typography/fontSize/body', 16);
  const lineH    = createNumber(global, 'typography/lineHeight/body', 24);
  const letterS  = createNumber(global, 'typography/letterSpacing/body', 0);
  const paraS    = createNumber(global, 'typography/paragraphSpacing/body', 8);

  const surfacePrimary = alias(aliasCol, 'surface/primary', brand);
  const textPrimary    = alias(aliasCol, 'text/primary', black);
  const textInverse    = alias(aliasCol, 'text/inverse', white);
  alias(aliasCol, 'text/body/fontSize',          fontSize);
  alias(aliasCol, 'text/body/lineHeight',         lineH);
  alias(aliasCol, 'text/body/letterSpacing',      letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',   paraS);

  alias(component, 'component/text/primary',    textPrimary);
  alias(component, 'component/text/inverse',    textInverse);
  alias(component, 'component/surface/primary', surfacePrimary);
  alias(component, 'component/icon/primary',    textPrimary);
  alias(component, 'component/icon/inverse',    textInverse);
  alias(component, 'component/border/default',  textPrimary);
}

function convertStylesToTokens(): void {
  const colorStyles = figma.getLocalPaintStyles();
  const textStyles  = figma.getLocalTextStyles();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify('⚠️ No styles found'); return;
  }

  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');
  const brightnessMap: Array<{ name: string; brightness: number; variable: Variable }> = [];

  colorStyles.forEach(style => {
    const paint = style.paints[0];
    if (!paint || paint.type !== 'SOLID') return;
    const name = style.name.replace(/\s+/g, '-').toLowerCase();
    const v = figma.variables.createVariable(`color/${name}`, global.id, 'COLOR');
    v.setValueForMode(global.modes[0].modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
    brightnessMap.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
  });

  brightnessMap.sort((a, b) => a.brightness - b.brightness);
  const darkest = brightnessMap[0];
  const lightest = brightnessMap[brightnessMap.length - 1];
  const primary  = brightnessMap[Math.floor(brightnessMap.length / 2)];

  if (primary) alias(aliasCol, 'surface/primary', primary.variable);
  if (darkest) alias(aliasCol, 'text/primary',    darkest.variable);
  if (lightest) alias(aliasCol, 'text/inverse',   lightest.variable);

  textStyles.forEach(style => {
    const name = style.name.replace(/\s+/g, '-').toLowerCase();
    const fs = createNumber(global, `typography/fontSize/${name}`, style.fontSize);
    const lhVal = style.lineHeight.unit === 'AUTO'
      ? style.fontSize * 1.4
      : (style.lineHeight as { unit: string; value: number }).value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100)
      : style.letterSpacing.value;
    const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
    const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
    alias(aliasCol, `text/${name}/fontSize`,        fs);
    alias(aliasCol, `text/${name}/lineHeight`,       lh);
    alias(aliasCol, `text/${name}/letterSpacing`,    ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
  });

  if (primary) alias(component, 'component/surface/primary', primary.variable);
  if (darkest) {
    alias(component, 'component/text/primary',   darkest.variable);
    alias(component, 'component/icon/primary',   darkest.variable);
    alias(component, 'component/border/default', darkest.variable);
  }
  if (lightest) {
    alias(component, 'component/text/inverse', lightest.variable);
    alias(component, 'component/icon/inverse', lightest.variable);
  }
  brightnessMap.forEach(item => alias(component, `component/surface/${item.name}`, item.variable));
  figma.notify('✅ Typography + color tokens created!');
}

function createStarterSystem2Tier(): void {
  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');

  const brand  = createColor(global, 'color/brand', 0.6, 0, 1);
  const white  = createColor(global, 'color/white', 1, 1, 1);
  const black  = createColor(global, 'color/black', 0.1, 0.1, 0.1);
  createNumber(global, 'spacing/16', 16);
  createNumber(global, 'borderRadius/md', 8);
  const fontSize = createNumber(global, 'typography/fontSize/body', 16);
  const lineH    = createNumber(global, 'typography/lineHeight/body', 24);
  const letterS  = createNumber(global, 'typography/letterSpacing/body', 0);
  const paraS    = createNumber(global, 'typography/paragraphSpacing/body', 8);

  alias(aliasCol, 'surface/primary',            brand);
  alias(aliasCol, 'text/primary',               black);
  alias(aliasCol, 'text/inverse',               white);
  alias(aliasCol, 'text/body/fontSize',         fontSize);
  alias(aliasCol, 'text/body/lineHeight',        lineH);
  alias(aliasCol, 'text/body/letterSpacing',     letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',  paraS);
}

function convertStylesToTokens2Tier(): void {
  const colorStyles = figma.getLocalPaintStyles();
  const textStyles  = figma.getLocalTextStyles();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify('⚠️ No styles found'); return;
  }

  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');
  const brightnessMap: Array<{ name: string; brightness: number; variable: Variable }> = [];

  colorStyles.forEach(style => {
    const paint = style.paints[0];
    if (!paint || paint.type !== 'SOLID') return;
    const name = style.name.replace(/\s+/g, '-').toLowerCase();
    const v = figma.variables.createVariable(`color/${name}`, global.id, 'COLOR');
    v.setValueForMode(global.modes[0].modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
    brightnessMap.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
  });

  brightnessMap.sort((a, b) => a.brightness - b.brightness);
  const darkest = brightnessMap[0];
  const lightest = brightnessMap[brightnessMap.length - 1];
  const primary  = brightnessMap[Math.floor(brightnessMap.length / 2)];

  if (primary) alias(aliasCol, 'surface/primary', primary.variable);
  if (darkest) alias(aliasCol, 'text/primary',    darkest.variable);
  if (lightest) alias(aliasCol, 'text/inverse',   lightest.variable);

  textStyles.forEach(style => {
    const name = style.name.replace(/\s+/g, '-').toLowerCase();
    const fs = createNumber(global, `typography/fontSize/${name}`, style.fontSize);
    const lhVal = style.lineHeight.unit === 'AUTO'
      ? style.fontSize * 1.4
      : (style.lineHeight as { unit: string; value: number }).value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100)
      : style.letterSpacing.value;
    const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
    const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
    alias(aliasCol, `text/${name}/fontSize`,        fs);
    alias(aliasCol, `text/${name}/lineHeight`,       lh);
    alias(aliasCol, `text/${name}/letterSpacing`,    ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
  });
  figma.notify('✅ Typography + color tokens created!');
}

// ─── FROM SCRATCH (stubs — implemented in Task 3) ─────────────────

function createFromScratch3Tier(
  _colors: ScratchColors,
  _spacingBase: number,
  _radiusBase: number
): void { figma.notify('TODO'); }

function createFromScratch2Tier(
  _colors: ScratchColors,
  _spacingBase: number,
  _radiusBase: number
): void { figma.notify('TODO'); }

// ─── JSON EXPORT (stub — implemented in Task 4) ───────────────────

function exportVariablesToJSON(): string { return '{}'; }

// ─── ORCHESTRATION ────────────────────────────────────────────────

function runGeneration(
  approach: string,
  mode: string,
  colors?: ScratchColors,
  spacingBase?: number,
  radiusBase?: number
): void {
  if (tokensExist()) {
    figma.ui.postMessage({ type: 'confirm-replace' }); return;
  }
  generate(approach, mode, colors, spacingBase, radiusBase);
}

function generate(
  approach: string,
  mode: string,
  colors?: ScratchColors,
  spacingBase?: number,
  radiusBase?: number
): void {
  deleteAllCollections();
  if (mode === 'scratch') {
    if (approach === '3tier') createFromScratch3Tier(colors!, spacingBase!, radiusBase!);
    else createFromScratch2Tier(colors!, spacingBase!, radiusBase!);
  } else if (approach === '3tier') {
    if (mode === 'starter') createStarterSystem();
    if (mode === 'convert') convertStylesToTokens();
  } else {
    if (mode === 'starter') createStarterSystem2Tier();
    if (mode === 'convert') convertStylesToTokens2Tier();
  }
  const json  = exportVariablesToJSON();
  const total = figma.variables.getLocalVariables().length;
  const cols  = figma.variables.getLocalVariableCollections().length;
  figma.notify('✅ Done!');
  figma.ui.postMessage({ type: 'generation-complete', json, total, cols });
}

// ─── MESSAGES ────────────────────────────────────────────────────

figma.ui.onmessage = (msg: {
  type: string;
  approach?: string;
  mode?: string;
  colors?: ScratchColors;
  spacingBase?: number;
  radiusBase?: number;
}) => {
  if (msg.type === 'generate') {
    runGeneration(msg.approach!, msg.mode!, msg.colors, msg.spacingBase, msg.radiusBase);
  }
  if (msg.type === 'confirm-continue') {
    generate(msg.approach!, msg.mode!, msg.colors, msg.spacingBase, msg.radiusBase);
  }
  if (msg.type === 'export-json') {
    if (!tokensExist()) { figma.notify('⚠️ No variables found — generate tokens first'); return; }
    const json  = exportVariablesToJSON();
    const total = figma.variables.getLocalVariables().length;
    const cols  = figma.variables.getLocalVariableCollections().length;
    figma.ui.postMessage({ type: 'export-ready', json, total, cols });
  }
  if (msg.type === 'check-tokens') {
    const exists = tokensExist();
    const total  = exists ? figma.variables.getLocalVariables().length : 0;
    const cols   = exists ? figma.variables.getLocalVariableCollections().length : 0;
    figma.ui.postMessage({ type: 'tokens-status', exists, total, cols });
  }
};
