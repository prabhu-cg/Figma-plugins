figma.showUI(__html__, { width: 560, height: 480 });

// ─── PURE ALGORITHMS ─────────────────────────────────────────────
// Keep in sync with tests/algorithms.test.js

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16) / 255,
    g: parseInt(c.slice(2, 4), 16) / 255,
    b: parseInt(c.slice(4, 6), 16) / 255,
  };
}

function rgbToHsl(r, g, b) {
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

function hslToRgb(h, s, l) {
  if (s === 0) return { r: l, g: l, b: l };
  const hue2rgb = (p, q, t) => {
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

function rgbToHex(r, g, b) {
  const h = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

const RAMP_STOPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

function generateColorRamp(hex) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  const lightnessMap = {
    50: 0.95, 100: 0.88, 200: 0.76, 300: 0.64, 400: 0.52,
    500: hsl.l,
    600: hsl.l * 0.78, 700: hsl.l * 0.58, 800: hsl.l * 0.40, 900: hsl.l * 0.24,
  };
  const satMap = {
    50: hsl.s * 0.30, 100: hsl.s * 0.45, 200: hsl.s * 0.60,
    300: hsl.s * 0.75, 400: hsl.s * 0.90, 500: hsl.s,
    600: Math.min(1, hsl.s * 1.05), 700: Math.min(1, hsl.s * 1.10),
    800: Math.min(1, hsl.s * 1.15), 900: Math.min(1, hsl.s * 1.20),
  };
  const result = {};
  for (const stop of RAMP_STOPS) result[stop] = hslToRgb(hsl.h, satMap[stop], lightnessMap[stop]);
  result[500] = rgb;
  return result;
}

const SPACING_MULTIPLIERS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];

function generateSpacingScale(base) {
  const scale = {};
  for (const m of SPACING_MULTIPLIERS) scale[String(base * m)] = base * m;
  return scale;
}

function generateRadiusScale(base) {
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

function createColor(collection, name, r, g, b) {
  const v = figma.variables.createVariable(name, collection.id, 'COLOR');
  v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
  return v;
}

function createNumber(collection, name, value) {
  const v = figma.variables.createVariable(name, collection.id, 'FLOAT');
  v.setValueForMode(collection.modes[0].modeId, value);
  return v;
}

function alias(collection, name, ref) {
  if (!ref) return;
  const v = figma.variables.createVariable(name, collection.id, ref.resolvedType);
  v.setValueForMode(collection.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: ref.id });
  return v;
}

function deleteAllCollections() {
  const collections = figma.variables.getLocalVariableCollections();
  const vars = figma.variables.getLocalVariables();
  collections.forEach(col => {
    vars.forEach(v => {
      if (v.variableCollectionId === col.id) { try { v.remove(); } catch (_e) {} }
    });
    try { col.remove(); } catch (_e) {}
  });
}

function tokensExist() {
  return figma.variables.getLocalVariableCollections().length > 0;
}

// ─── EXISTING GENERATION ─────────────────────────────────────────

function createStarterSystem() {
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
  alias(aliasCol, 'text/body/fontSize',         fontSize);
  alias(aliasCol, 'text/body/lineHeight',        lineH);
  alias(aliasCol, 'text/body/letterSpacing',     letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',  paraS);

  alias(component, 'component/text/primary',    textPrimary);
  alias(component, 'component/text/inverse',    textInverse);
  alias(component, 'component/surface/primary', surfacePrimary);
  alias(component, 'component/icon/primary',    textPrimary);
  alias(component, 'component/icon/inverse',    textInverse);
  alias(component, 'component/border/default',  textPrimary);
}

function convertStylesToTokens() {
  const colorStyles = figma.getLocalPaintStyles();
  const textStyles  = figma.getLocalTextStyles();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify('⚠️ No styles found'); return;
  }

  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');
  const brightnessMap = [];

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
    const lhVal = style.lineHeight.unit === 'AUTO' ? style.fontSize * 1.4 : style.lineHeight.value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100) : style.letterSpacing.value;
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

function createStarterSystem2Tier() {
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

function convertStylesToTokens2Tier() {
  const colorStyles = figma.getLocalPaintStyles();
  const textStyles  = figma.getLocalTextStyles();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    figma.notify('⚠️ No styles found'); return;
  }

  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');
  const brightnessMap = [];

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
    const lhVal = style.lineHeight.unit === 'AUTO' ? style.fontSize * 1.4 : style.lineHeight.value;
    const lh = createNumber(global, `typography/lineHeight/${name}`, lhVal);
    const lsVal = style.letterSpacing.unit === 'PERCENT'
      ? style.fontSize * (style.letterSpacing.value / 100) : style.letterSpacing.value;
    const ls = createNumber(global, `typography/letterSpacing/${name}`, lsVal);
    const ps = createNumber(global, `typography/paragraphSpacing/${name}`, style.paragraphSpacing || 0);
    alias(aliasCol, `text/${name}/fontSize`,        fs);
    alias(aliasCol, `text/${name}/lineHeight`,       lh);
    alias(aliasCol, `text/${name}/letterSpacing`,    ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
  });
  figma.notify('✅ Typography + color tokens created!');
}

// ─── FROM SCRATCH (stubs — replaced in Task 3) ───────────────────

function addColorRampToCollection(col, colorName, hex) {
  const ramp = generateColorRamp(hex);
  const vars = {};
  for (const stop of RAMP_STOPS) {
    const { r, g, b } = ramp[stop];
    vars[stop] = createColor(col, `color/${colorName}/${stop}`, r, g, b);
  }
  return vars;
}

function createFromScratch3Tier(colors, spacingBase, radiusBase) {
  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');

  const primary   = addColorRampToCollection(global, 'primary',   colors.primary);
  const secondary = addColorRampToCollection(global, 'secondary', colors.secondary);
  const tertiary  = addColorRampToCollection(global, 'tertiary',  colors.tertiary);
  const info      = addColorRampToCollection(global, 'info',      colors.info);
  const success   = addColorRampToCollection(global, 'success',   colors.success);
  const error     = addColorRampToCollection(global, 'error',     colors.error);
  const warning   = addColorRampToCollection(global, 'warning',   colors.warning);
  const accent    = addColorRampToCollection(global, 'accent',    colors.accent);
  const neutral   = addColorRampToCollection(global, 'neutral',   colors.neutral);

  const spacingScale = generateSpacingScale(spacingBase);
  for (const [key, val] of Object.entries(spacingScale)) createNumber(global, `spacing/${key}`, val);

  const radiusScale = generateRadiusScale(radiusBase);
  for (const [key, val] of Object.entries(radiusScale)) createNumber(global, `borderRadius/${key}`, val);

  const fontSize = createNumber(global, 'typography/fontSize/body',        16);
  const lineH    = createNumber(global, 'typography/lineHeight/body',       24);
  const letterS  = createNumber(global, 'typography/letterSpacing/body',    0);
  const paraS    = createNumber(global, 'typography/paragraphSpacing/body', 8);

  const surfPrimary   = alias(aliasCol, 'surface/primary',   primary[500]);
  const surfSecondary = alias(aliasCol, 'surface/secondary', secondary[500]);
  const surfTertiary  = alias(aliasCol, 'surface/tertiary',  tertiary[500]);
  const textPrimary   = alias(aliasCol, 'text/primary',      primary[900]);
  const textInverse   = alias(aliasCol, 'text/inverse',      primary[50]);

  const infoDefault    = alias(aliasCol, 'semantic/info/default',    info[500]);
  const infoSubtle     = alias(aliasCol, 'semantic/info/subtle',     info[100]);
  const successDefault = alias(aliasCol, 'semantic/success/default', success[500]);
  const successSubtle  = alias(aliasCol, 'semantic/success/subtle',  success[100]);
  const errorDefault   = alias(aliasCol, 'semantic/error/default',   error[500]);
  const errorSubtle    = alias(aliasCol, 'semantic/error/subtle',    error[100]);
  const warnDefault    = alias(aliasCol, 'semantic/warning/default', warning[500]);
  const warnSubtle     = alias(aliasCol, 'semantic/warning/subtle',  warning[100]);

  const surfAccent    = alias(aliasCol, 'surface/accent',          accent[500]);
  const textOnAccent  = alias(aliasCol, 'text/onAccent',           accent[50]);
  const accentDefault = alias(aliasCol, 'semantic/accent/default', accent[500]);
  const accentSubtle  = alias(aliasCol, 'semantic/accent/subtle',  accent[100]);

  const textSecondary = alias(aliasCol, 'text/secondary',          neutral[700]);
  const textDisabled  = alias(aliasCol, 'text/disabled',           neutral[400]);
  const borderDefault = alias(aliasCol, 'border/default',          neutral[200]);
  alias(aliasCol, 'border/strong',          neutral[400]);
  const bgSubtle      = alias(aliasCol, 'background/subtle',       neutral[50]);
  alias(aliasCol, 'background/muted',       neutral[100]);

  const allVars = figma.variables.getLocalVariables();
  const findVar = (name) => allVars.find(v => v.name === name);
  const sp = (mult) => findVar(`spacing/${spacingBase * mult}`);
  if (sp(1))  alias(aliasCol, 'spacing/xs', sp(1));
  if (sp(2))  alias(aliasCol, 'spacing/sm', sp(2));
  if (sp(4))  alias(aliasCol, 'spacing/md', sp(4));
  if (sp(6))  alias(aliasCol, 'spacing/lg', sp(6));
  if (sp(10)) alias(aliasCol, 'spacing/xl', sp(10));

  const radiusMd = findVar('borderRadius/md');
  if (radiusMd) alias(aliasCol, 'borderRadius/default', radiusMd);

  alias(aliasCol, 'text/body/fontSize',         fontSize);
  alias(aliasCol, 'text/body/lineHeight',        lineH);
  alias(aliasCol, 'text/body/letterSpacing',     letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',  paraS);

  alias(component, 'component/text/primary',            textPrimary);
  alias(component, 'component/text/inverse',            textInverse);
  alias(component, 'component/text/secondary',          textSecondary);
  alias(component, 'component/text/disabled',           textDisabled);
  alias(component, 'component/surface/primary',         surfPrimary);
  alias(component, 'component/surface/secondary',       surfSecondary);
  alias(component, 'component/surface/tertiary',        surfTertiary);
  alias(component, 'component/surface/accent',          surfAccent);
  alias(component, 'component/icon/primary',            textPrimary);
  alias(component, 'component/icon/inverse',            textInverse);
  alias(component, 'component/border/default',          borderDefault);
  alias(component, 'component/background/subtle',       bgSubtle);
  alias(component, 'component/feedback/info',           infoDefault);
  alias(component, 'component/feedback/info/subtle',    infoSubtle);
  alias(component, 'component/feedback/success',        successDefault);
  alias(component, 'component/feedback/success/subtle', successSubtle);
  alias(component, 'component/feedback/error',          errorDefault);
  alias(component, 'component/feedback/error/subtle',   errorSubtle);
  alias(component, 'component/feedback/warning',        warnDefault);
  alias(component, 'component/feedback/warning/subtle', warnSubtle);
}

function createFromScratch2Tier(colors, spacingBase, radiusBase) {
  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');

  const primary   = addColorRampToCollection(global, 'primary',   colors.primary);
  const secondary = addColorRampToCollection(global, 'secondary', colors.secondary);
  const tertiary  = addColorRampToCollection(global, 'tertiary',  colors.tertiary);
  const info      = addColorRampToCollection(global, 'info',      colors.info);
  const success   = addColorRampToCollection(global, 'success',   colors.success);
  const error     = addColorRampToCollection(global, 'error',     colors.error);
  const warning   = addColorRampToCollection(global, 'warning',   colors.warning);
  const accent    = addColorRampToCollection(global, 'accent',    colors.accent);
  const neutral   = addColorRampToCollection(global, 'neutral',   colors.neutral);

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
  alias(aliasCol, 'semantic/warning/default',   warning[500]);
  alias(aliasCol, 'semantic/warning/subtle',    warning[100]);

  alias(aliasCol, 'surface/accent',             accent[500]);
  alias(aliasCol, 'text/onAccent',              accent[50]);
  alias(aliasCol, 'semantic/accent/default',    accent[500]);
  alias(aliasCol, 'semantic/accent/subtle',     accent[100]);

  alias(aliasCol, 'text/secondary',             neutral[700]);
  alias(aliasCol, 'text/disabled',              neutral[400]);
  alias(aliasCol, 'border/default',             neutral[200]);
  alias(aliasCol, 'border/strong',              neutral[400]);
  alias(aliasCol, 'background/subtle',          neutral[50]);
  alias(aliasCol, 'background/muted',           neutral[100]);

  const allVars = figma.variables.getLocalVariables();
  const findVar = (name) => allVars.find(v => v.name === name);
  const sp = (mult) => findVar(`spacing/${spacingBase * mult}`);
  if (sp(1))  alias(aliasCol, 'spacing/xs', sp(1));
  if (sp(2))  alias(aliasCol, 'spacing/sm', sp(2));
  if (sp(4))  alias(aliasCol, 'spacing/md', sp(4));
  if (sp(6))  alias(aliasCol, 'spacing/lg', sp(6));
  if (sp(10)) alias(aliasCol, 'spacing/xl', sp(10));

  const radiusMd = findVar('borderRadius/md');
  if (radiusMd) alias(aliasCol, 'borderRadius/default', radiusMd);

  alias(aliasCol, 'text/body/fontSize',         fontSize);
  alias(aliasCol, 'text/body/lineHeight',        lineH);
  alias(aliasCol, 'text/body/letterSpacing',     letterS);
  alias(aliasCol, 'text/body/paragraphSpacing',  paraS);
}

// ─── JSON EXPORT ─────────────────────────────────────────────────

function exportVariablesToJSON() {
  const collections = figma.variables.getLocalVariableCollections();
  const allVars     = figma.variables.getLocalVariables();
  const idToVar     = new Map(allVars.map(v => [v.id, v]));

  const root = {};

  for (const variable of allVars) {
    const collection = collections.find(c => c.id === variable.variableCollectionId);
    if (!collection) continue;
    const modeId   = collection.modes[0].modeId;
    const rawValue = variable.valuesByMode[modeId];

    const parts = variable.name.split('/');
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = {};
      node = node[parts[i]];
    }
    const leaf = parts[parts.length - 1];

    if (rawValue && typeof rawValue === 'object' && rawValue.type === 'VARIABLE_ALIAS') {
      const refVar = idToVar.get(rawValue.id);
      if (refVar) node[leaf] = { value: `{${refVar.name.replace(/\//g, '.')}}` };
    } else if (variable.resolvedType === 'COLOR') {
      node[leaf] = { value: rgbToHex(rawValue.r, rawValue.g, rawValue.b) };
    } else {
      node[leaf] = { value: rawValue };
    }
  }

  return JSON.stringify(root, null, 2);
}

// ─── ORCHESTRATION ────────────────────────────────────────────────

function runGeneration(approach, mode, colors, spacingBase, radiusBase) {
  if (tokensExist()) {
    figma.ui.postMessage({ type: 'confirm-replace' }); return;
  }
  generate(approach, mode, colors, spacingBase, radiusBase);
}

function generate(approach, mode, colors, spacingBase, radiusBase) {
  deleteAllCollections();
  if (mode === 'scratch') {
    if (approach === '3tier') createFromScratch3Tier(colors, spacingBase, radiusBase);
    else createFromScratch2Tier(colors, spacingBase, radiusBase);
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

figma.ui.onmessage = (msg) => {
  if (msg.type === 'generate') {
    runGeneration(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase);
  }
  if (msg.type === 'confirm-continue') {
    generate(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase);
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
