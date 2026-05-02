# Token System Generator Pro v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the plugin to support From Scratch color ramp generation, configurable spacing/radius scales, and a Style Dictionary v3 JSON export — all within a 4-screen wizard that adds a Smart Landing screen for re-entrant export.

**Architecture:** `code.ts` is the single TypeScript source compiled to `code.js` by `tsc`. All plugin logic lives there (pure algorithms at the top, Figma API calls below). `ui.html` is a self-contained 5-screen wizard (Smart Landing + Screens 1–4) with plain JS state management. Pure algorithmic functions are mirrored in `tests/algorithms.test.js` and verified with `node`.

**Tech Stack:** TypeScript 5, Figma Plugin API, plain browser JS in ui.html, Node.js for test runner (no new runtime dependencies).

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `code.ts` | Rewrite | All plugin logic: algorithms, generation, export, message handling |
| `code.js` | Generated | Output of `npm run build` — do not edit directly after Task 1 |
| `ui.html` | Rewrite | Full 5-screen wizard UI |
| `tests/algorithms.test.js` | Create | Pure function tests, run with `node` |

---

## Task 1: Port existing code.js to code.ts + add algorithm stubs

**Files:**
- Rewrite: `code.ts`

- [ ] **Step 1: Replace code.ts with the full TypeScript port of current code.js, plus empty stubs for new functions**

```typescript
figma.showUI(__html__, { width: 560, height: 480 });

// ─── TYPES ───────────────────────────────────────────────────────

interface RGB { r: number; g: number; b: number }

interface ScratchColors {
  primary: string;
  secondary: string;
  tertiary: string;
  info: string;
  success: string;
  error: string;
  warning: string;
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
  result[500] = rgb; // exact input preserved
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
  const global = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');

  const brand = createColor(global, 'color/brand', 0.6, 0, 1);
  const white = createColor(global, 'color/white', 1, 1, 1);
  const black = createColor(global, 'color/black', 0.1, 0.1, 0.1);
  const space16 = createNumber(global, 'spacing/16', 16);
  const radius8  = createNumber(global, 'borderRadius/md', 8);
  const fontSize  = createNumber(global, 'typography/fontSize/body', 16);
  const lineH     = createNumber(global, 'typography/lineHeight/body', 24);
  const letterS   = createNumber(global, 'typography/letterSpacing/body', 0);
  const paraS     = createNumber(global, 'typography/paragraphSpacing/body', 8);

  const surfacePrimary = alias(aliasCol, 'surface/primary', brand);
  const textPrimary    = alias(aliasCol, 'text/primary', black);
  const textInverse    = alias(aliasCol, 'text/inverse', white);
  alias(aliasCol, 'text/body/fontSize', fontSize);
  alias(aliasCol, 'text/body/lineHeight', lineH);
  alias(aliasCol, 'text/body/letterSpacing', letterS);
  alias(aliasCol, 'text/body/paragraphSpacing', paraS);

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
    const lhVal = style.lineHeight.unit === 'AUTO' ? style.fontSize * 1.4 : (style.lineHeight as { value: number }).value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100) : style.letterSpacing.value;
    const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
    const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
    alias(aliasCol, `text/${name}/fontSize`,          fs);
    alias(aliasCol, `text/${name}/lineHeight`,         lh);
    alias(aliasCol, `text/${name}/letterSpacing`,      ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`,   ps);
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

  alias(aliasCol, 'surface/primary',             brand);
  alias(aliasCol, 'text/primary',                black);
  alias(aliasCol, 'text/inverse',                white);
  alias(aliasCol, 'text/body/fontSize',          fontSize);
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
    const lhVal = style.lineHeight.unit === 'AUTO' ? style.fontSize * 1.4 : (style.lineHeight as { value: number }).value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100) : style.letterSpacing.value;
    const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
    const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
    alias(aliasCol, `text/${name}/fontSize`,         fs);
    alias(aliasCol, `text/${name}/lineHeight`,        lh);
    alias(aliasCol, `text/${name}/letterSpacing`,     ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`,  ps);
  });
}

// ─── FROM SCRATCH (stubs — implemented in Tasks 3 & 4) ───────────

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

// ─── JSON EXPORT (stub — implemented in Task 5) ───────────────────

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
  const json = exportVariablesToJSON();
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
    const json = exportVariablesToJSON();
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
```

- [ ] **Step 2: Build and verify TypeScript compiles without errors**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro" && npm run build 2>&1
```

Expected: no errors, `code.js` updated.

- [ ] **Step 3: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git init
git add code.ts code.js
git commit -m "chore: port code.js to typed code.ts with algorithm stubs"
```

---

## Task 2: Write and run algorithm tests

**Files:**
- Create: `tests/algorithms.test.js`

- [ ] **Step 1: Create test file with pure function mirrors and failing assertions**

```javascript
// Run with: node tests/algorithms.test.js
// Pure functions mirrored from code.ts — keep in sync manually.

let passed = 0, failed = 0;

function test(name, fn) {
  try { fn(); console.log(`✅ ${name}`); passed++; }
  catch (e) { console.error(`❌ ${name}: ${e.message}`); failed++; }
}
function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`Expected ${e}, got ${a} ${msg}`);
}
function assertApprox(actual, expected, delta = 0.01, msg = '') {
  if (Math.abs(actual - expected) > delta)
    throw new Error(`Expected ~${expected}, got ${actual} (Δ${delta}) ${msg}`);
}

// ── Mirrored implementations ──────────────────────────────────────

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return { r: parseInt(c.slice(0,2),16)/255, g: parseInt(c.slice(2,4),16)/255, b: parseInt(c.slice(4,6),16)/255 };
}
function rgbToHsl(r, g, b) {
  const max = Math.max(r,g,b), min = Math.min(r,g,b), l = (max+min)/2;
  if (max===min) return {h:0,s:0,l};
  const d = max-min, s = l>0.5 ? d/(2-max-min) : d/(max+min);
  let h=0;
  if (max===r) h=((g-b)/d+(g<b?6:0))/6;
  else if (max===g) h=((b-r)/d+2)/6;
  else h=((r-g)/d+4)/6;
  return {h,s,l};
}
function hslToRgb(h, s, l) {
  if (s===0) return {r:l,g:l,b:l};
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const hue2rgb = (p,q,t) => {
    if (t<0) t+=1; if (t>1) t-=1;
    if (t<1/6) return p+(q-p)*6*t; if (t<1/2) return q;
    if (t<2/3) return p+(q-p)*(2/3-t)*6; return p;
  };
  return { r:hue2rgb(p,q,h+1/3), g:hue2rgb(p,q,h), b:hue2rgb(p,q,h-1/3) };
}
function rgbToHex(r,g,b) {
  const h = n => Math.round(n*255).toString(16).padStart(2,'0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
const RAMP_STOPS = [50,100,200,300,400,500,600,700,800,900];
function generateColorRamp(hex) {
  const rgb = hexToRgb(hex), hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lMap = {50:.95,100:.88,200:.76,300:.64,400:.52,500:hsl.l,
    600:hsl.l*.78,700:hsl.l*.58,800:hsl.l*.40,900:hsl.l*.24};
  const sMap = {50:hsl.s*.30,100:hsl.s*.45,200:hsl.s*.60,300:hsl.s*.75,400:hsl.s*.90,500:hsl.s,
    600:Math.min(1,hsl.s*1.05),700:Math.min(1,hsl.s*1.10),
    800:Math.min(1,hsl.s*1.15),900:Math.min(1,hsl.s*1.20)};
  const result = {};
  for (const stop of RAMP_STOPS) result[stop] = hslToRgb(hsl.h, sMap[stop], lMap[stop]);
  result[500] = rgb;
  return result;
}
const SPACING_MULTIPLIERS = [1,2,3,4,5,6,8,10,12,16];
function generateSpacingScale(base) {
  const s = {};
  for (const m of SPACING_MULTIPLIERS) s[String(base*m)] = base*m;
  return s;
}
function generateRadiusScale(base) {
  return { none:0, sm:Math.max(1,Math.round(base/2)), md:base, lg:base*2, xl:base*4, '2xl':base*6, full:9999 };
}

// ── Tests ─────────────────────────────────────────────────────────

test('hexToRgb #6600ff', () => {
  const {r,g,b} = hexToRgb('#6600ff');
  assertApprox(r, 0.400); assertApprox(g, 0); assertApprox(b, 1.000);
});
test('hexToRgb #000000', () => {
  const {r,g,b} = hexToRgb('#000000');
  assertEqual({r,g,b}, {r:0,g:0,b:0});
});
test('hexToRgb #ffffff', () => {
  const {r,g,b} = hexToRgb('#ffffff');
  assertEqual({r,g,b}, {r:1,g:1,b:1});
});
test('rgbToHex round-trips hexToRgb', () => {
  const hex = '#6600ff';
  const {r,g,b} = hexToRgb(hex);
  assertEqual(rgbToHex(r,g,b), hex);
});
test('generateColorRamp returns 10 stops', () => {
  assertEqual(Object.keys(generateColorRamp('#6600ff')).length, 10);
});
test('generateColorRamp stop 500 equals exact input', () => {
  const hex = '#6600ff';
  const ramp = generateColorRamp(hex);
  assertEqual(rgbToHex(ramp[500].r, ramp[500].g, ramp[500].b), hex);
});
test('generateColorRamp 50 is lighter than 500', () => {
  const ramp = generateColorRamp('#6600ff');
  const l50  = rgbToHsl(ramp[50].r,  ramp[50].g,  ramp[50].b).l;
  const l500 = rgbToHsl(ramp[500].r, ramp[500].g, ramp[500].b).l;
  if (l50 <= l500) throw new Error(`50(${l50}) not lighter than 500(${l500})`);
});
test('generateColorRamp 900 is darker than 500', () => {
  const ramp = generateColorRamp('#6600ff');
  const l900 = rgbToHsl(ramp[900].r, ramp[900].g, ramp[900].b).l;
  const l500 = rgbToHsl(ramp[500].r, ramp[500].g, ramp[500].b).l;
  if (l900 >= l500) throw new Error(`900(${l900}) not darker than 500(${l500})`);
});
test('generateSpacingScale base=4 returns 10 values', () => {
  assertEqual(Object.keys(generateSpacingScale(4)).length, 10);
});
test('generateSpacingScale base=4 starts at 4', () => {
  assertEqual(Object.keys(generateSpacingScale(4))[0], '4');
});
test('generateSpacingScale base=4 ends at 64', () => {
  const vals = Object.values(generateSpacingScale(4));
  assertEqual(vals[vals.length-1], 64);
});
test('generateSpacingScale base=8 scales correctly', () => {
  const s = generateSpacingScale(8);
  assertEqual(s['8'], 8); assertEqual(s['16'], 16); assertEqual(s['128'], 128);
});
test('generateRadiusScale returns 7 stops', () => {
  assertEqual(Object.keys(generateRadiusScale(4)).length, 7);
});
test('generateRadiusScale none is 0', () => {
  assertEqual(generateRadiusScale(4).none, 0);
});
test('generateRadiusScale md equals base', () => {
  assertEqual(generateRadiusScale(4).md, 4);
  assertEqual(generateRadiusScale(8).md, 8);
});
test('generateRadiusScale full is 9999', () => {
  assertEqual(generateRadiusScale(4).full, 9999);
});
test('generateRadiusScale stops are strictly ascending', () => {
  const s = generateRadiusScale(4);
  const vals = [s.none, s.sm, s.md, s.lg, s.xl, s['2xl'], s.full];
  for (let i=0; i<vals.length-1; i++)
    if (vals[i] >= vals[i+1]) throw new Error(`Stop ${i}(${vals[i]}) >= stop ${i+1}(${vals[i+1]})`);
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
```

- [ ] **Step 2: Run tests — verify all pass**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro" && node tests/algorithms.test.js
```

Expected output: 17 passed, 0 failed

- [ ] **Step 3: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git add tests/algorithms.test.js
git commit -m "test: add pure algorithm tests for color ramp, spacing, and radius"
```

---

## Task 3: Implement createFromScratch3Tier and createFromScratch2Tier

**Files:**
- Modify: `code.ts` (replace stubs at `createFromScratch3Tier` and `createFromScratch2Tier`)

- [ ] **Step 1: Replace the stub implementations**

Replace:
```typescript
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
```

With:
```typescript
function addColorRampToCollection(
  col: VariableCollection,
  colorName: string,
  hex: string
): Record<RampStop, Variable> {
  const ramp = generateColorRamp(hex);
  const vars = {} as Record<RampStop, Variable>;
  for (const stop of RAMP_STOPS) {
    const { r, g, b } = ramp[stop];
    vars[stop] = createColor(col, `color/${colorName}/${stop}`, r, g, b);
  }
  return vars;
}

function createFromScratch3Tier(
  colors: ScratchColors,
  spacingBase: number,
  radiusBase: number
): void {
  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');

  // ── Global: color ramps ──
  const primary   = addColorRampToCollection(global, 'primary',   colors.primary);
  const secondary = addColorRampToCollection(global, 'secondary', colors.secondary);
  const tertiary  = addColorRampToCollection(global, 'tertiary',  colors.tertiary);
  const info      = addColorRampToCollection(global, 'info',      colors.info);
  const success   = addColorRampToCollection(global, 'success',   colors.success);
  const error     = addColorRampToCollection(global, 'error',     colors.error);
  const warning   = addColorRampToCollection(global, 'warning',   colors.warning);

  // ── Global: spacing ──
  const spacingScale = generateSpacingScale(spacingBase);
  for (const [key, val] of Object.entries(spacingScale)) {
    createNumber(global, `spacing/${key}`, val);
  }

  // ── Global: border radius ──
  const radiusScale = generateRadiusScale(radiusBase);
  for (const [key, val] of Object.entries(radiusScale)) {
    createNumber(global, `borderRadius/${key}`, val);
  }

  // ── Global: typography ──
  const fontSize = createNumber(global, 'typography/fontSize/body',         16);
  const lineH    = createNumber(global, 'typography/lineHeight/body',        24);
  const letterS  = createNumber(global, 'typography/letterSpacing/body',     0);
  const paraS    = createNumber(global, 'typography/paragraphSpacing/body',  8);

  // ── Alias: surfaces & text ──
  const surfPrimary   = alias(aliasCol, 'surface/primary',   primary[500]);
  const surfSecondary = alias(aliasCol, 'surface/secondary', secondary[500]);
  const surfTertiary  = alias(aliasCol, 'surface/tertiary',  tertiary[500]);
  const textPrimary   = alias(aliasCol, 'text/primary',      primary[900]);
  const textInverse   = alias(aliasCol, 'text/inverse',      primary[50]);

  // ── Alias: semantic ──
  const infoDefault    = alias(aliasCol, 'semantic/info/default',    info[500]);
  const infoSubtle     = alias(aliasCol, 'semantic/info/subtle',     info[100]);
  const successDefault = alias(aliasCol, 'semantic/success/default', success[500]);
  const successSubtle  = alias(aliasCol, 'semantic/success/subtle',  success[100]);
  const errorDefault   = alias(aliasCol, 'semantic/error/default',   error[500]);
  const errorSubtle    = alias(aliasCol, 'semantic/error/subtle',    error[100]);
  const warnDefault    = alias(aliasCol, 'semantic/warning/default', warning[500]);
  const warnSubtle     = alias(aliasCol, 'semantic/warning/subtle',  warning[100]);

  // ── Alias: spacing semantic shortcuts ──
  const sp4  = figma.variables.getLocalVariables().find(v => v.name === `spacing/${spacingBase}`);
  const sp8  = figma.variables.getLocalVariables().find(v => v.name === `spacing/${spacingBase * 2}`);
  const sp16 = figma.variables.getLocalVariables().find(v => v.name === `spacing/${spacingBase * 4}`);
  const sp24 = figma.variables.getLocalVariables().find(v => v.name === `spacing/${spacingBase * 6}`);
  const sp40 = figma.variables.getLocalVariables().find(v => v.name === `spacing/${spacingBase * 10}`);
  if (sp4)  alias(aliasCol, 'spacing/xs', sp4);
  if (sp8)  alias(aliasCol, 'spacing/sm', sp8);
  if (sp16) alias(aliasCol, 'spacing/md', sp16);
  if (sp24) alias(aliasCol, 'spacing/lg', sp24);
  if (sp40) alias(aliasCol, 'spacing/xl', sp40);

  const radiusMd = figma.variables.getLocalVariables().find(v => v.name === 'borderRadius/md');
  if (radiusMd) alias(aliasCol, 'borderRadius/default', radiusMd);

  // ── Alias: typography ──
  alias(aliasCol, 'text/body/fontSize',          fontSize);
  alias(aliasCol, 'text/body/lineHeight',         lineH);
  alias(aliasCol, 'text/body/letterSpacing',      letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',   paraS);

  // ── Component ──
  alias(component, 'component/text/primary',           textPrimary);
  alias(component, 'component/text/inverse',           textInverse);
  alias(component, 'component/surface/primary',        surfPrimary);
  alias(component, 'component/surface/secondary',      surfSecondary);
  alias(component, 'component/surface/tertiary',       surfTertiary);
  alias(component, 'component/icon/primary',           textPrimary);
  alias(component, 'component/icon/inverse',           textInverse);
  alias(component, 'component/border/default',         textPrimary);
  alias(component, 'component/feedback/info',          infoDefault);
  alias(component, 'component/feedback/info/subtle',   infoSubtle);
  alias(component, 'component/feedback/success',       successDefault);
  alias(component, 'component/feedback/success/subtle',successSubtle);
  alias(component, 'component/feedback/error',         errorDefault);
  alias(component, 'component/feedback/error/subtle',  errorSubtle);
  alias(component, 'component/feedback/warning',       warnDefault);
  alias(component, 'component/feedback/warning/subtle',warnSubtle);
}

function createFromScratch2Tier(
  colors: ScratchColors,
  spacingBase: number,
  radiusBase: number
): void {
  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');

  const primary   = addColorRampToCollection(global, 'primary',   colors.primary);
  const secondary = addColorRampToCollection(global, 'secondary', colors.secondary);
  const tertiary  = addColorRampToCollection(global, 'tertiary',  colors.tertiary);
  const info      = addColorRampToCollection(global, 'info',      colors.info);
  const success   = addColorRampToCollection(global, 'success',   colors.success);
  const error     = addColorRampToCollection(global, 'error',     colors.error);
  const warning   = addColorRampToCollection(global, 'warning',   colors.warning);

  const spacingScale = generateSpacingScale(spacingBase);
  for (const [key, val] of Object.entries(spacingScale)) createNumber(global, `spacing/${key}`, val);

  const radiusScale = generateRadiusScale(radiusBase);
  for (const [key, val] of Object.entries(radiusScale)) createNumber(global, `borderRadius/${key}`, val);

  const fontSize = createNumber(global, 'typography/fontSize/body',        16);
  const lineH    = createNumber(global, 'typography/lineHeight/body',       24);
  const letterS  = createNumber(global, 'typography/letterSpacing/body',    0);
  const paraS    = createNumber(global, 'typography/paragraphSpacing/body', 8);

  alias(aliasCol, 'surface/primary',   primary[500]);
  alias(aliasCol, 'surface/secondary', secondary[500]);
  alias(aliasCol, 'surface/tertiary',  tertiary[500]);
  alias(aliasCol, 'text/primary',      primary[900]);
  alias(aliasCol, 'text/inverse',      primary[50]);

  alias(aliasCol, 'semantic/info/default',    info[500]);
  alias(aliasCol, 'semantic/info/subtle',     info[100]);
  alias(aliasCol, 'semantic/success/default', success[500]);
  alias(aliasCol, 'semantic/success/subtle',  success[100]);
  alias(aliasCol, 'semantic/error/default',   error[500]);
  alias(aliasCol, 'semantic/error/subtle',    error[100]);
  alias(aliasCol, 'semantic/warning/default', warning[500]);
  alias(aliasCol, 'semantic/warning/subtle',  warning[100]);

  alias(aliasCol, 'text/body/fontSize',         fontSize);
  alias(aliasCol, 'text/body/lineHeight',        lineH);
  alias(aliasCol, 'text/body/letterSpacing',     letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',  paraS);
}
```

- [ ] **Step 2: Build**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro" && npm run build 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git add code.ts code.js
git commit -m "feat: implement createFromScratch 2-tier and 3-tier token generation"
```

---

## Task 4: Implement exportVariablesToJSON

**Files:**
- Modify: `code.ts` (replace `exportVariablesToJSON` stub)

- [ ] **Step 1: Replace the stub**

Replace:
```typescript
function exportVariablesToJSON(): string { return '{}'; }
```

With:
```typescript
function exportVariablesToJSON(): string {
  const collections = figma.variables.getLocalVariableCollections();
  const allVars     = figma.variables.getLocalVariables();
  const idToVar     = new Map(allVars.map(v => [v.id, v]));

  const root: Record<string, unknown> = {};

  for (const variable of allVars) {
    const collection = collections.find(c => c.id === variable.variableCollectionId);
    if (!collection) continue;
    const modeId = collection.modes[0].modeId;
    const rawValue = variable.valuesByMode[modeId];

    // Drill into nested path
    const parts = variable.name.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]] as Record<string, unknown>;
    }
    const leaf = parts[parts.length - 1];

    if (
      typeof rawValue === 'object' &&
      rawValue !== null &&
      'type' in rawValue &&
      (rawValue as { type: string }).type === 'VARIABLE_ALIAS'
    ) {
      const refVar = idToVar.get((rawValue as { type: string; id: string }).id);
      if (refVar) node[leaf] = { value: `{${refVar.name.replace(/\//g, '.')}}` };
    } else if (variable.resolvedType === 'COLOR') {
      const c = rawValue as RGBA;
      node[leaf] = { value: rgbToHex(c.r, c.g, c.b) };
    } else {
      node[leaf] = { value: rawValue };
    }
  }

  return JSON.stringify(root, null, 2);
}
```

- [ ] **Step 2: Build**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro" && npm run build 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git add code.ts code.js
git commit -m "feat: implement Style Dictionary v3 JSON export from Figma variables"
```

---

## Task 5: Rewrite ui.html — structure, styles, and Smart Landing

**Files:**
- Rewrite: `ui.html`

- [ ] **Step 1: Replace ui.html with the new 5-screen shell (Smart Landing + Screens 1–4)**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Token System Generator Pro</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23EE661D'/><rect x='4' y='6.5' width='24' height='6' rx='2' fill='white'/><rect x='11' y='14.5' width='10' height='5' rx='1.5' fill='white' fill-opacity='.75'/><rect x='11' y='21.5' width='10' height='5' rx='1.5' fill='white' fill-opacity='.5'/></svg>">
  <style>
    /* ── Reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; }
    body { font-family: Inter, sans-serif; background: #fafafa; display: flex; flex-direction: column; }

    /* ── Wizard shell ── */
    .wizard { position: relative; flex: 1; overflow: hidden; }

    /* ── Screens ── */
    .screen {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      transition: transform 0.28s ease, opacity 0.22s ease;
    }
    .screen.slide-out-left  { transform: translateX(-100%); opacity: 0; pointer-events: none; }
    .screen.slide-out-right { transform: translateX(100%);  opacity: 0; pointer-events: none; }

    /* ── Scrollable content area ── */
    .screen-body { flex: 1; overflow-y: auto; padding: 20px 20px 0; }
    .screen-footer { padding: 14px 20px 20px; flex-shrink: 0; }

    /* ── Top nav (back + badge) ── */
    .top-nav {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 20px 0; flex-shrink: 0;
    }
    .back-btn {
      font-size: 12px; font-weight: 500; color: #EE661D; cursor: pointer;
      background: none; border: none; padding: 0; font-family: Inter, sans-serif;
      transition: color .18s; display: flex; align-items: center; gap: 4px;
    }
    .back-btn:hover { color: #c84f10; }
    .approach-badge {
      font-size: 11px; color: #EE661D; background: #FFF9EB;
      border: 1px solid #f5c8a0; border-radius: 20px; padding: 3px 10px; font-weight: 500;
    }

    /* ── Header ── */
    .header { margin-bottom: 14px; }
    .header h2 { font-size: 17px; font-weight: 700; color: #111; margin-bottom: 4px; }
    .header p  { font-size: 12px; color: #888; line-height: 1.5; }

    /* ── Divider ── */
    .divider { height: 1px; background: #eee; margin-bottom: 14px; }

    /* ── Section heading ── */
    .section-heading { margin-bottom: 12px; }
    .section-heading strong { display: block; font-size: 14px; font-weight: 600; color: #111; margin-bottom: 3px; }
    .section-heading p { font-size: 12px; color: #888; line-height: 1.5; }

    /* ── Cards ── */
    .cards { display: flex; gap: 12px; }
    .card {
      flex: 1; border-radius: 10px; padding: 14px; background: white;
      border: 1.5px solid #eee; cursor: pointer;
      transition: border-color .18s, background .18s, box-shadow .18s;
      display: flex; flex-direction: column; gap: 8px;
      position: relative; user-select: none;
    }
    .card:hover { border-color: #EE661D; box-shadow: 0 4px 14px rgba(0,0,0,.07); }
    .card.selected { border-color: #EE661D; background: #FFF9EB; }
    .card-icon-wrap {
      width: 38px; height: 38px; border-radius: 9px; background: #f3f3f3;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: background .18s;
    }
    .card:hover .card-icon-wrap, .card.selected .card-icon-wrap { background: rgba(238,102,29,.12); }
    .card-icon { color: #c0c0c0; transition: color .18s; display: block; }
    .card:hover .card-icon, .card.selected .card-icon { color: #EE661D; }
    .card-title  { font-size: 13px; font-weight: 600; color: #111; padding-right: 22px; line-height: 1.4; }
    .card-subtitle { font-size: 11px; font-weight: 400; color: #aaa; }
    .card-desc   { font-size: 11.5px; color: #666; line-height: 1.6; }
    .card-check  {
      display: none; position: absolute; top: 11px; right: 11px;
      width: 18px; height: 18px; border-radius: 50%; background: #EE661D;
      align-items: center; justify-content: center; flex-shrink: 0;
    }
    .card.selected .card-check { display: flex; }

    /* ── Primary button ── */
    .btn-primary {
      width: 100%; height: 38px; border: none; border-radius: 8px;
      font-size: 13px; font-family: Inter, sans-serif; font-weight: 500;
      cursor: pointer; transition: background .2s; background: #EE661D; color: white;
    }
    .btn-primary:hover:not(:disabled) { background: #555; }
    .btn-primary:disabled { background: #e0e0e0; color: #aaa; cursor: not-allowed; }

    /* ── Hint ── */
    .hint { font-size: 11px; color: #c0c0c0; text-align: center; margin-top: 10px; }

    /* ── Color input rows (Screen 2) ── */
    .color-section-label {
      font-size: 12px; font-weight: 600; color: #111;
      margin: 14px 0 8px; display: block;
    }
    .color-row {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 8px;
    }
    .color-row label { font-size: 12px; color: #555; width: 80px; flex-shrink: 0; }
    .color-swatch {
      width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
      background: #eee; border: 1.5px solid transparent; transition: border-color .18s;
    }
    .color-swatch.invalid { border-color: #ff4444 !important; }
    .color-input {
      flex: 1; height: 28px; border: 1.5px solid #e0e0e0; border-radius: 6px;
      padding: 0 8px; font-size: 12px; font-family: Inter, sans-serif;
      outline: none; transition: border-color .18s;
    }
    .color-input:focus { border-color: #EE661D; }
    .color-input.invalid { border-color: #ff4444; }

    /* ── Scale input rows (Screen 2) ── */
    .scale-section { margin-top: 16px; }
    .scale-row { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 4px; }
    .scale-row label { font-size: 12px; color: #555; width: 110px; flex-shrink: 0; padding-top: 6px; }
    .scale-input-wrap { flex: 1; }
    .scale-input {
      height: 28px; width: 70px; border: 1.5px solid #e0e0e0; border-radius: 6px;
      padding: 0 8px; font-size: 12px; font-family: Inter, sans-serif;
      outline: none; transition: border-color .18s;
    }
    .scale-input:focus { border-color: #EE661D; }
    .scale-preview {
      font-size: 11px; color: #EE661D; margin-top: 4px; font-weight: 500;
      letter-spacing: -.01em;
    }
    .scale-hint { font-size: 11px; color: #aaa; margin-top: 3px; line-height: 1.5; }

    /* ── Export panel (Screen 4) ── */
    .export-success {
      display: flex; align-items: center; gap: 10px;
      background: #f0fdf4; border: 1px solid #86efac;
      border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;
    }
    .export-success span { font-size: 12px; color: #166534; font-weight: 500; }
    .json-panel-label { font-size: 12px; font-weight: 600; color: #111; margin-bottom: 6px; }
    .json-panel {
      background: #1e1e2e; border-radius: 8px; padding: 12px;
      height: 200px; overflow-y: auto;
      font-size: 11px; font-family: 'Menlo', 'Consolas', monospace;
      color: #cdd6f4; line-height: 1.6; white-space: pre;
    }
    .export-actions { display: flex; gap: 8px; margin-top: 10px; }
    .btn-secondary {
      flex: 1; height: 34px; border: 1.5px solid #EE661D; border-radius: 8px;
      font-size: 12px; font-family: Inter, sans-serif; font-weight: 500;
      cursor: pointer; transition: background .18s, color .18s;
      background: white; color: #EE661D;
    }
    .btn-secondary:hover { background: #FFF9EB; }
    .export-footer { display: flex; gap: 8px; margin-top: 8px; }
    .btn-ghost {
      flex: 1; height: 32px; border: 1px solid #e0e0e0; border-radius: 8px;
      font-size: 11px; font-family: Inter, sans-serif; font-weight: 500;
      cursor: pointer; background: white; color: #888; transition: border-color .18s, color .18s;
    }
    .btn-ghost:hover { border-color: #888; color: #444; }
  </style>
</head>
<body>

<div class="wizard">

  <!-- ══════════════════════════════════════════
       SMART LANDING
  ══════════════════════════════════════════ -->
  <div class="screen slide-out-left" id="screen-landing">
    <div class="screen-body">
      <div class="header" style="padding-top:20px">
        <h2>Token System Generator Pro</h2>
        <p>Your token variables are ready.</p>
      </div>
      <div class="divider"></div>
      <div class="section-heading">
        <strong>What would you like to do?</strong>
        <p id="landing-summary">Found existing variable collections.</p>
      </div>
      <div class="cards">
        <div class="card" id="card-export" onclick="landingExport()">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2v12M6 10l5 5 5-5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3 17h16" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="card-title">Export to JSON</div>
          <div class="card-desc">Generate dev-ready Style Dictionary tokens from your current Figma variables.</div>
        </div>
        <div class="card" id="card-regenerate" onclick="landingRegenerate()">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M2.5 7.5H16.5M13 3.5L17 7.5L13 11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19.5 14.5H5.5M9 10.5L5 14.5L9 18.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="card-title">Regenerate Tokens</div>
          <div class="card-desc">Start fresh — replace existing variables with a new token system.</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       SCREEN 1 — Mode selection
  ══════════════════════════════════════════ -->
  <div class="screen slide-out-right" id="screen1">
    <div class="screen-body">
      <div class="header">
        <h2>Token System Generator Pro</h2>
        <p>Create or convert your design system foundations in seconds.</p>
      </div>
      <div class="divider"></div>
      <div class="section-heading">
        <strong>Choose your approach</strong>
        <p>How do you want to build your token system?</p>
      </div>
      <div class="cards" style="flex-wrap:wrap; gap:10px;">
        <div class="card" id="card-scratch" onclick="selectMode('scratch')" style="min-width:calc(50% - 5px)">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <circle cx="11" cy="11" r="4" stroke="currentColor" stroke-width="1.7"/>
              <path d="M11 3v2M11 17v2M3 11h2M17 11h2M5.6 5.6l1.4 1.4M15 15l1.4 1.4M5.6 16.4l1.4-1.4M15 7l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="card-title">From Scratch</div>
          <div class="card-desc">Pick your brand colors and generate full ramps with spacing and radius scales.</div>
        </div>
        <div class="card" id="card-starter" onclick="selectMode('starter')" style="min-width:calc(50% - 5px)">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1.5" y="1.5" width="19" height="19" rx="2.5" stroke="currentColor" stroke-width="1.7"/>
              <line x1="1.5" y1="8.5" x2="20.5" y2="8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="11"  y1="8.5" x2="11"   y2="20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="card-title">Starter System <span class="card-subtitle">(Boilerplate)</span></div>
          <div class="card-desc">Clean, ready-to-use token set with best-practice defaults. Perfect for starting fresh.</div>
        </div>
        <div class="card" id="card-convert" onclick="selectMode('convert')" style="min-width:100%">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M2.5 7.5H16.5M13 3.5L17 7.5L13 11.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M19.5 14.5H5.5M9 10.5L5 14.5L9 18.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="card-title">Smart Convert</div>
          <div class="card-desc">Scans your existing local styles and maps them into a structured token hierarchy.</div>
        </div>
      </div>
      <div class="hint" style="padding-bottom:20px">Click a card to continue</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       SCREEN 2 — Color / Scale picker (From Scratch)
  ══════════════════════════════════════════ -->
  <div class="screen slide-out-right" id="screen2">
    <div class="top-nav">
      <button class="back-btn" onclick="goTo('screen1','right')">← Change approach</button>
      <span class="approach-badge">From Scratch</span>
    </div>
    <div class="screen-body" style="padding-top:14px">

      <span class="color-section-label">Brand Colors <span style="color:#ff4444;font-size:10px">* required</span></span>
      <div class="color-row">
        <label>Primary</label>
        <div class="color-swatch" id="sw-primary"></div>
        <input class="color-input" id="inp-primary" type="text" placeholder="#6600FF" oninput="onColorInput('primary')">
      </div>
      <div class="color-row">
        <label>Secondary</label>
        <div class="color-swatch" id="sw-secondary"></div>
        <input class="color-input" id="inp-secondary" type="text" placeholder="#00AAFF" oninput="onColorInput('secondary')">
      </div>
      <div class="color-row">
        <label>Tertiary</label>
        <div class="color-swatch" id="sw-tertiary"></div>
        <input class="color-input" id="inp-tertiary" type="text" placeholder="#FF6600" oninput="onColorInput('tertiary')">
      </div>

      <span class="color-section-label" style="margin-top:18px">Semantic Colors</span>
      <div class="color-row">
        <label>Info</label>
        <div class="color-swatch" id="sw-info" style="background:#0066FF"></div>
        <input class="color-input" id="inp-info" type="text" value="#0066FF" oninput="onColorInput('info')">
      </div>
      <div class="color-row">
        <label>Success</label>
        <div class="color-swatch" id="sw-success" style="background:#00BB66"></div>
        <input class="color-input" id="inp-success" type="text" value="#00BB66" oninput="onColorInput('success')">
      </div>
      <div class="color-row">
        <label>Error</label>
        <div class="color-swatch" id="sw-error" style="background:#FF3333"></div>
        <input class="color-input" id="inp-error" type="text" value="#FF3333" oninput="onColorInput('error')">
      </div>
      <div class="color-row">
        <label>Warning</label>
        <div class="color-swatch" id="sw-warning" style="background:#FFAA00"></div>
        <input class="color-input" id="inp-warning" type="text" value="#FFAA00" oninput="onColorInput('warning')">
      </div>

      <div class="scale-section">
        <span class="color-section-label">Spacing</span>
        <div class="scale-row">
          <label>Base unit (px)</label>
          <div class="scale-input-wrap">
            <input class="scale-input" id="inp-spacing" type="number" min="1" max="32" value="4" oninput="onSpacingInput()">
            <div class="scale-preview" id="preview-spacing">Scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64</div>
            <div class="scale-hint">Use 4 or 8 for grid-friendly layouts. Your base unit is the smallest spacing step.</div>
          </div>
        </div>
      </div>

      <div class="scale-section" style="margin-bottom:20px">
        <span class="color-section-label">Border Radius</span>
        <div class="scale-row">
          <label>Base radius (px)</label>
          <div class="scale-input-wrap">
            <input class="scale-input" id="inp-radius" type="number" min="0" max="64" value="4" oninput="onRadiusInput()">
            <div class="scale-preview" id="preview-radius">none(0) · sm(2) · md(4) · lg(8) · xl(16) · 2xl(24) · full(∞)</div>
            <div class="scale-hint">Controls rounding feel: 0 = sharp, 4 = subtle, 8 = friendly, 16 = soft.</div>
          </div>
        </div>
      </div>

    </div>
    <div class="screen-footer">
      <button class="btn-primary" id="btn-next2" disabled onclick="goTo('screen3','left')">Next: Choose Architecture →</button>
      <div class="hint" id="hint-next2">Fill in all 3 brand colors to continue</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       SCREEN 3 — Architecture
  ══════════════════════════════════════════ -->
  <div class="screen slide-out-right" id="screen3">
    <div class="top-nav">
      <button class="back-btn" id="back3" onclick="backFromScreen3()">← Change approach</button>
      <span class="approach-badge" id="badge3"></span>
    </div>
    <div class="screen-body" style="padding-top:14px">
      <div class="section-heading">
        <strong>Choose architecture</strong>
        <p>How many layers should your token system have?</p>
      </div>
      <div class="cards">
        <div class="card" id="card-2tier" onclick="selectArch('2tier')">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1.5" y="12"  width="19" height="8.5" rx="2.2" stroke="currentColor" stroke-width="1.7"/>
              <rect x="1.5" y="1.5" width="19" height="8.5" rx="2.2" stroke="currentColor" stroke-width="1.7"/>
            </svg>
          </div>
          <div class="card-title">2 Tier System</div>
          <div class="card-desc">Global and Alias layers only. Ideal for smaller projects or teams starting their token journey.</div>
        </div>
        <div class="card" id="card-3tier" onclick="selectArch('3tier')">
          <div class="card-check"><svg width="10" height="10" viewBox="0 0 10 10" fill="none"><polyline points="1.5,5 4,7.5 8.5,2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
          <div class="card-icon-wrap">
            <svg class="card-icon" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="1.5" y="15.5" width="19" height="5.5" rx="1.8" stroke="currentColor" stroke-width="1.7"/>
              <rect x="1.5" y="8.3"  width="19" height="5.5" rx="1.8" stroke="currentColor" stroke-width="1.7"/>
              <rect x="1.5" y="1"    width="19" height="5.5" rx="1.8" stroke="currentColor" stroke-width="1.7"/>
            </svg>
          </div>
          <div class="card-title">3 Tier System</div>
          <div class="card-desc">Global, Alias, and Component layers. Built for mature design systems needing component-level control.</div>
        </div>
      </div>
    </div>
    <div class="screen-footer">
      <button class="btn-primary" id="btn-generate" disabled onclick="doGenerate()">Generate Tokens</button>
      <div class="hint" id="hint-generate">Select an architecture above to generate</div>
    </div>
  </div>

  <!-- ══════════════════════════════════════════
       SCREEN 4 — Done + Export
  ══════════════════════════════════════════ -->
  <div class="screen slide-out-right" id="screen4">
    <div class="screen-body">
      <div class="export-success">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="8" fill="#22c55e"/>
          <polyline points="5,9 8,12 13,6" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span id="export-summary">Tokens created successfully.</span>
      </div>
      <div class="json-panel-label">JSON Export <span style="font-size:10px;font-weight:400;color:#aaa">(Style Dictionary v3)</span></div>
      <div class="json-panel" id="json-panel"></div>
      <div class="export-actions">
        <button class="btn-secondary" onclick="copyJSON()">Copy to clipboard</button>
        <button class="btn-secondary" onclick="downloadJSON()">Download tokens.json</button>
      </div>
      <div class="export-footer">
        <button class="btn-ghost" onclick="refreshJSON()">↺ Refresh JSON</button>
        <button class="btn-ghost" onclick="startOver()">← Start over</button>
      </div>
    </div>
  </div>

</div><!-- /.wizard -->

<script>
  // ── State ──────────────────────────────────────────────────────
  let selectedMode = null;   // 'scratch' | 'starter' | 'convert'
  let selectedArch = null;   // '2tier' | '3tier'
  let currentJSON  = '';

  const colorFields    = ['primary','secondary','tertiary','info','success','error','warning'];
  const requiredColors = ['primary','secondary','tertiary'];

  // ── Screen transitions ──────────────────────────────────────────
  function goTo(targetId, direction) {
    const current = document.querySelector('.screen:not(.slide-out-left):not(.slide-out-right)');
    if (current) current.classList.add(direction === 'left' ? 'slide-out-left' : 'slide-out-right');
    const target = document.getElementById(targetId);
    target.classList.remove('slide-out-left','slide-out-right');
  }

  // ── Smart Landing ───────────────────────────────────────────────
  function landingExport() {
    parent.postMessage({ pluginMessage: { type: 'export-json' } }, '*');
  }
  function landingRegenerate() {
    goTo('screen1', 'left');
  }

  // ── Screen 1: Mode ──────────────────────────────────────────────
  function selectMode(value) {
    selectedMode = value;
    selectedArch = null;
    ['scratch','starter','convert'].forEach(id => {
      document.getElementById('card-' + id).classList.toggle('selected', id === value);
    });
    document.getElementById('card-2tier').classList.remove('selected');
    document.getElementById('card-3tier').classList.remove('selected');
    document.getElementById('btn-generate').disabled = true;
    document.getElementById('hint-generate').textContent = 'Select an architecture above to generate';

    const modeLabels = { scratch: 'From Scratch', starter: 'Starter System', convert: 'Smart Convert' };
    document.getElementById('badge3').textContent = modeLabels[value];

    setTimeout(() => {
      if (value === 'scratch') goTo('screen2','left');
      else goTo('screen3','left');
    }, 200);
  }

  // ── Screen 2: Colors + Scale ────────────────────────────────────
  function isValidHex(hex) { return /^#[0-9A-Fa-f]{6}$/.test(hex); }

  function normalizeHex(val) {
    val = val.trim();
    if (!val.startsWith('#')) val = '#' + val;
    return val;
  }

  function onColorInput(field) {
    const input = document.getElementById('inp-' + field);
    const swatch = document.getElementById('sw-' + field);
    const val = normalizeHex(input.value);
    const valid = isValidHex(val);
    swatch.style.background = valid ? val : '#eee';
    swatch.classList.toggle('invalid', !valid);
    input.classList.toggle('invalid', input.value !== '' && !valid);
    validateScreen2();
  }

  function onSpacingInput() {
    const base = parseInt(document.getElementById('inp-spacing').value) || 0;
    const mults = [1,2,3,4,5,6,8,10,12,16];
    const preview = base > 0 ? 'Scale: ' + mults.map(m => m*base).join(' · ') : '';
    document.getElementById('preview-spacing').textContent = preview;
    validateScreen2();
  }

  function onRadiusInput() {
    const base = parseInt(document.getElementById('inp-radius').value);
    if (isNaN(base)) { document.getElementById('preview-radius').textContent = ''; return; }
    const sm = Math.max(1, Math.round(base / 2));
    document.getElementById('preview-radius').textContent =
      `none(0) · sm(${sm}) · md(${base}) · lg(${base*2}) · xl(${base*4}) · 2xl(${base*6}) · full(∞)`;
    validateScreen2();
  }

  function validateScreen2() {
    const allBrandValid = requiredColors.every(f => {
      const val = normalizeHex(document.getElementById('inp-' + f).value);
      return isValidHex(val);
    });
    const spacingOk = parseInt(document.getElementById('inp-spacing').value) >= 1;
    const radiusOk  = parseInt(document.getElementById('inp-radius').value)  >= 0;
    const ok = allBrandValid && spacingOk && radiusOk;
    document.getElementById('btn-next2').disabled = !ok;
    document.getElementById('hint-next2').textContent = ok
      ? 'Ready — click Next to choose architecture'
      : 'Fill in all 3 brand colors to continue';
  }

  function backFromScreen3() {
    if (selectedMode === 'scratch') goTo('screen2','right');
    else goTo('screen1','right');
  }

  // ── Screen 3: Architecture ──────────────────────────────────────
  function selectArch(value) {
    selectedArch = value;
    document.getElementById('card-2tier').classList.toggle('selected', value === '2tier');
    document.getElementById('card-3tier').classList.toggle('selected', value === '3tier');
    document.getElementById('btn-generate').disabled = false;
    document.getElementById('hint-generate').textContent = 'Ready — click Generate Tokens';
  }

  // ── Generate ────────────────────────────────────────────────────
  function doGenerate() {
    if (!selectedMode || !selectedArch) return;
    const msg = { type: 'generate', approach: selectedArch, mode: selectedMode };
    if (selectedMode === 'scratch') {
      msg.colors = {
        primary:   normalizeHex(document.getElementById('inp-primary').value),
        secondary: normalizeHex(document.getElementById('inp-secondary').value),
        tertiary:  normalizeHex(document.getElementById('inp-tertiary').value),
        info:      normalizeHex(document.getElementById('inp-info').value),
        success:   normalizeHex(document.getElementById('inp-success').value),
        error:     normalizeHex(document.getElementById('inp-error').value),
        warning:   normalizeHex(document.getElementById('inp-warning').value),
      };
      msg.spacingBase = parseInt(document.getElementById('inp-spacing').value);
      msg.radiusBase  = parseInt(document.getElementById('inp-radius').value);
    }
    parent.postMessage({ pluginMessage: msg }, '*');
  }

  // ── Screen 4: Export ────────────────────────────────────────────
  function showExport(json, total, cols) {
    currentJSON = json;
    document.getElementById('json-panel').textContent = json;
    document.getElementById('export-summary').textContent =
      `${total} variables created across ${cols} collection${cols !== 1 ? 's' : ''}.`;
    goTo('screen4','left');
  }

  function copyJSON() {
    navigator.clipboard.writeText(currentJSON)
      .then(() => { const b = event.target; b.textContent = '✅ Copied!'; setTimeout(() => b.textContent = 'Copy to clipboard', 2000); });
  }

  function downloadJSON() {
    const blob = new Blob([currentJSON], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'tokens.json'; a.click();
    URL.revokeObjectURL(url);
  }

  function refreshJSON() {
    parent.postMessage({ pluginMessage: { type: 'export-json' } }, '*');
  }

  function startOver() {
    selectedMode = null; selectedArch = null; currentJSON = '';
    ['scratch','starter','convert','2tier','3tier'].forEach(id => {
      const el = document.getElementById('card-' + id);
      if (el) el.classList.remove('selected');
    });
    goTo('screen1','right');
  }

  // ── Messages from code.js ───────────────────────────────────────
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (!msg) return;

    if (msg.type === 'tokens-status') {
      if (msg.exists) {
        document.getElementById('landing-summary').textContent =
          `Found ${msg.total} variables across ${msg.cols} collection${msg.cols !== 1 ? 's' : ''}.`;
        goTo('screen-landing', 'left');
      } else {
        goTo('screen1', 'right');
      }
    }

    if (msg.type === 'confirm-replace') {
      const ok = confirm('⚠️ Tokens already exist.\n\nClick OK to replace them or Cancel to stop.');
      if (ok) {
        const m = { type: 'confirm-continue', approach: selectedArch, mode: selectedMode };
        if (selectedMode === 'scratch') {
          m.colors = {
            primary:   normalizeHex(document.getElementById('inp-primary').value),
            secondary: normalizeHex(document.getElementById('inp-secondary').value),
            tertiary:  normalizeHex(document.getElementById('inp-tertiary').value),
            info:      normalizeHex(document.getElementById('inp-info').value),
            success:   normalizeHex(document.getElementById('inp-success').value),
            error:     normalizeHex(document.getElementById('inp-error').value),
            warning:   normalizeHex(document.getElementById('inp-warning').value),
          };
          m.spacingBase = parseInt(document.getElementById('inp-spacing').value);
          m.radiusBase  = parseInt(document.getElementById('inp-radius').value);
        }
        parent.postMessage({ pluginMessage: m }, '*');
      }
    }

    if (msg.type === 'generation-complete' || msg.type === 'export-ready') {
      showExport(msg.json, msg.total, msg.cols);
    }
  };

  // ── Bootstrap: ask plugin if tokens exist ───────────────────────
  parent.postMessage({ pluginMessage: { type: 'check-tokens' } }, '*');
</script>

</body>
</html>
```

- [ ] **Step 2: Build**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro" && npm run build 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git add ui.html code.js
git commit -m "feat: rewrite ui.html with 5-screen wizard (Smart Landing + From Scratch + Export)"
```

---

## Task 6: Manual verification in Figma

No automated test is possible here — load the plugin in Figma dev mode and verify each flow.

- [ ] **Step 1: Load plugin in Figma**

In Figma desktop: Plugins → Development → Import plugin from manifest → select `manifest.json` in this folder.

- [ ] **Step 2: Verify Smart Landing (tokens exist path)**

1. Generate any token set once (use Starter + 2 Tier)
2. Close and reopen the plugin
3. Expected: Smart Landing screen appears with variable count
4. Click "Export to JSON" → Screen 4 appears with valid JSON
5. Click "Refresh JSON" → JSON reloads with same data
6. Click "Regenerate" → Screen 1 appears

- [ ] **Step 3: Verify From Scratch flow (3-tier)**

1. Start over → Screen 1 → From Scratch
2. Screen 2: enter `#6600FF` primary, `#00AAFF` secondary, `#FF6600` tertiary (semantics at defaults)
3. Verify live swatches update and scale previews show correct values
4. Click Next → Screen 3 → select 3 Tier → Generate
5. In Figma Variables panel: verify 3 collections: 01 Global, 02 Alias, 03 Component
6. In 01 Global: verify `color/primary/50` through `color/primary/900` exist
7. In 01 Global: verify `borderRadius/none`, `borderRadius/sm` … `borderRadius/full` exist
8. In 01 Global: verify `spacing/4` through `spacing/64` (10 values) exist
9. In 02 Alias: verify `surface/primary` is an alias → `color/primary/500`
10. In 02 Alias: verify `semantic/error/default` → `color/error/500`
11. In 03 Component: verify `component/feedback/error` → `semantic/error/default`
12. Screen 4 appears with JSON — verify JSON contains `color.primary.500`, `borderRadius.md`, `spacing.4`

- [ ] **Step 4: Verify From Scratch flow (2-tier)**

Repeat step 3 choosing 2 Tier. Verify only 2 collections (no 03 Component). JSON should still contain all tokens.

- [ ] **Step 5: Verify Starter and Smart Convert still work**

1. Start over → Starter + 3 Tier → Generate → Screen 4 appears with JSON ✅
2. Start over → Smart Convert (requires paint/text styles in the file) → 3 Tier → Generate ✅

- [ ] **Step 6: Verify JSON export buttons**

1. On Screen 4, click "Copy to clipboard" → paste in text editor, verify valid JSON
2. Click "Download tokens.json" → file downloads, open it, verify valid JSON
3. Manually edit a variable value in Figma → click "↺ Refresh JSON" → value updates in panel

- [ ] **Step 7: Commit**

```bash
cd "/Users/prc/Documents/Personal/Token System Generator Pro"
git add -A
git commit -m "feat: token system generator pro v2 — complete"
```

---

## Quick Reference

**Build:** `npm run build`
**Run tests:** `node tests/algorithms.test.js`
**Load in Figma:** Plugins → Development → Import from manifest
