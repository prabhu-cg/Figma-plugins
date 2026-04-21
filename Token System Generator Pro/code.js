figma.showUI(__html__, { width: 560, height: 505 });

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

const STARTER_COLORS = {
  primary:   '#3D6BE8',
  secondary: '#7C3AED',
  tertiary:  '#0891B2',
  accent:    '#EA580C',
  info:      '#3B82F6',
  success:   '#22C55E',
  error:     '#EF4444',
  warning:   '#F59E0B',
  neutral:   '#6B7280',
};

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

function generateBorderWidthScale(base) {
  return {
    none: 0,
    sm:   base,
    md:   base * 2,
    lg:   base * 4,
    xl:   base * 8,
  };
}

// ─── COLOR NAME DETECTION ────────────────────────────────────────
// Names never overlap with the semantic reserved words: blue, green, red, amber, grey.

function getColorName(hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return 'charcoal';
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const hDeg = h * 360;
  const sPct = s * 100;
  const lPct = l * 100;

  if (sPct < 8) return lPct >= 70 ? 'silver' : 'charcoal';

  let base;
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

// Returns { primary: 'Red', secondary: 'Red2', info: 'Info', error: 'Error', ... }
// Semantic colors always keep fixed names. Brand colors get hue names, deduped among themselves only.
function buildColorNameMap(colors) {
  const semanticFixed = { info: 'blue', success: 'green', error: 'red', warning: 'amber', neutral: 'grey' };

  const brandKeys = ['primary', 'secondary', 'accent'];
  if (colors.tertiary && /^#[0-9A-Fa-f]{6}$/.test(colors.tertiary)) brandKeys.splice(2, 0, 'tertiary');

  const brandRaw = {};
  for (var i = 0; i < brandKeys.length; i++) {
    var bk = brandKeys[i];
    if (colors[bk] && /^#[0-9A-Fa-f]{6}$/.test(colors[bk])) brandRaw[bk] = getColorName(colors[bk]);
  }

  const counts = {};
  for (var k in brandRaw) counts[brandRaw[k]] = (counts[brandRaw[k]] || 0) + 1;

  const seen = {};
  const nameMap = {};
  for (var k in brandRaw) {
    var name = brandRaw[k];
    if (counts[name] > 1) { seen[name] = (seen[name] || 0) + 1; nameMap[k] = name + seen[name]; }
    else nameMap[k] = name;
  }

  for (var sk in semanticFixed) {
    if (colors[sk] && /^#[0-9A-Fa-f]{6}$/.test(colors[sk])) nameMap[sk] = semanticFixed[sk];
  }
  return nameMap;
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
  figma.getLocalPaintStyles().forEach(s => { try { s.remove(); } catch (_e) {} });
  figma.getLocalTextStyles().forEach(s => { try { s.remove(); } catch (_e) {} });
}

function tokensExist() {
  return figma.variables.getLocalVariableCollections().length > 0;
}

// ─── EXISTING GENERATION ─────────────────────────────────────────

async function createStarterSystem() {
  return createFromScratch3Tier(STARTER_COLORS, 4, 4, 1, 16, 'major-third');
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

async function createStarterSystem2Tier() {
  return createFromScratch2Tier(STARTER_COLORS, 4, 4, 1, 16, 'major-third');
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

// ─── TYPOGRAPHY SCALE ─────────────────────────────────────────────

const TS_RATIO = {
  'major-second':   1.125,
  'minor-third':    1.200,
  'major-third':    1.250,
  'perfect-fourth': 1.333,
  'aug-fourth':     1.414,
};

function generateTypographyScale(fontBase, ratioKey) {
  const ratio = TS_RATIO[ratioKey] !== undefined ? TS_RATIO[ratioKey] : 1.25;
  const levels = [
    { name: 'display-lg', step: 10, lh: 100, ls: -5, ps: 0 },
    { name: 'display-md', step:  9, lh: 100, ls: -5, ps: 0 },
    { name: 'display-sm', step:  8, lh: 105, ls: -4, ps: 0 },
    { name: 'h1',         step:  7, lh: 110, ls: -3, ps: 0 },
    { name: 'h2',         step:  6, lh: 110, ls: -3, ps: 0 },
    { name: 'h3',         step:  5, lh: 120, ls: -2, ps: 0 },
    { name: 'h4',         step:  4, lh: 120, ls: -2, ps: 0 },
    { name: 'h5',         step:  3, lh: 120, ls:  0, ps: 0 },
    { name: 'h6',         step:  2, lh: 120, ls:  0, ps: 0 },
    { name: 'body-lg',    step:  1, lh: 150, ls:  0, ps: 8 },
    { name: 'body',       step:  0, lh: 150, ls:  0, ps: 8 },
    { name: 'caption',    step: -1, lh: 140, ls:  1, ps: 4 },
    { name: 'xs',         step: -2, lh: 140, ls:  2, ps: 4 },
  ];
  return levels.map(({ name, step, lh, ls, ps }) => ({
    name,
    fontSize:         Math.round(fontBase * Math.pow(ratio, step) / 4) * 4,
    lineHeight:       lh,   // percent value (e.g. 110 = 110%)
    letterSpacing:    ls,   // percent value (e.g. -3 = -3%)
    paragraphSpacing: ps,   // pixels
  }));
}

const TYPE_STYLE_NAMES = {
  'display-lg': 'Display/Large',  'display-md': 'Display/Medium', 'display-sm': 'Display/Small',
  'h1': 'Heading/H1', 'h2': 'Heading/H2', 'h3': 'Heading/H3',
  'h4': 'Heading/H4', 'h5': 'Heading/H5', 'h6': 'Heading/H6',
  'body-lg': 'Body/Large', 'body': 'Body/Regular',
  'caption': 'Body/Caption',      'xs': 'Body/XSmall',
};

const TYPE_FONT_WEIGHTS = {
  'display-lg': 'Bold', 'display-md': 'Bold', 'display-sm': 'Bold',
  'h1': 'Bold',         'h2': 'Bold',
  'h3': 'SemiBold',     'h4': 'SemiBold', 'h5': 'SemiBold', 'h6': 'Medium',
  'body-lg': 'Regular', 'body': 'Regular', 'caption': 'Regular', 'xs': 'Regular',
};

function createPaintStylesForColors(colors, colorNames) {
  const order = ['primary', 'secondary', 'accent', 'info', 'success', 'error', 'warning', 'neutral'];
  if (colorNames.tertiary) order.splice(2, 0, 'tertiary');
  for (var i = 0; i < order.length; i++) {
    var key = order[i];
    var hex = colors[key];
    if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex) || !colorNames[key]) continue;
    const ramp  = generateColorRamp(hex);
    const label = colorNames[key];
    for (const stop of RAMP_STOPS) {
      const { r, g, b } = ramp[stop];
      const s = figma.createPaintStyle();
      s.name   = `${label}/${stop}`;
      s.paints = [{ type: 'SOLID', color: { r, g, b } }];
    }
  }
}

async function createTextStylesForScale(typoScale, fsVars, lhVars, lsVars, psVars) {
  for (const w of ['Regular', 'Medium', 'SemiBold', 'Bold']) {
    try { await figma.loadFontAsync({ family: 'Inter', style: w }); } catch (_) {}
  }
  for (const t of typoScale) {
    try {
      const style         = figma.createTextStyle();
      style.name          = TYPE_STYLE_NAMES[t.name] || t.name;
      style.fontName      = { family: 'Inter', style: TYPE_FONT_WEIGHTS[t.name] || 'Regular' };
      style.fontSize      = t.fontSize;
      style.lineHeight    = { unit: 'PERCENT', value: t.lineHeight };
      style.letterSpacing = { unit: 'PERCENT', value: t.letterSpacing };
      style.paragraphSpacing = t.paragraphSpacing;
      try { if (fsVars[t.name]) style.setBoundVariable('fontSize',        fsVars[t.name]); } catch (_) {}
      try { if (lhVars[t.name]) style.setBoundVariable('lineHeight',       lhVars[t.name]); } catch (_) {}
      try { if (lsVars[t.name]) style.setBoundVariable('letterSpacing',    lsVars[t.name]); } catch (_) {}
      try { if (psVars[t.name]) style.setBoundVariable('paragraphSpacing', psVars[t.name]); } catch (_) {}
    } catch (_) {}
  }
}

// ─── FROM SCRATCH ─────────────────────────────────────────────────

function addColorRampToCollection(col, colorName, hex) {
  if (!hex || !/^#[0-9A-Fa-f]{6}$/.test(hex)) return null;
  const ramp = generateColorRamp(hex);
  const vars = {};
  for (const stop of RAMP_STOPS) {
    const { r, g, b } = ramp[stop];
    vars[stop] = createColor(col, `color/${colorName}/${stop}`, r, g, b);
  }
  return vars;
}

async function createFromScratch3Tier(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
  const colorNames = buildColorNameMap(colors);
  const hasTertiary = !!colorNames.tertiary;

  const global    = figma.variables.createVariableCollection('01 Global');
  const aliasCol  = figma.variables.createVariableCollection('02 Alias');
  const component = figma.variables.createVariableCollection('03 Component');

  // ── Global: brand colors first, semantic colors second ──
  const primary   = addColorRampToCollection(global, colorNames.primary,   colors.primary);
  const secondary = addColorRampToCollection(global, colorNames.secondary, colors.secondary);
  const tertiary  = hasTertiary ? addColorRampToCollection(global, colorNames.tertiary, colors.tertiary) : null;
  const accent    = addColorRampToCollection(global, colorNames.accent,    colors.accent);
  const info      = addColorRampToCollection(global, colorNames.info,      colors.info);
  const success   = addColorRampToCollection(global, colorNames.success,   colors.success);
  const error     = addColorRampToCollection(global, colorNames.error,     colors.error);
  const warning   = addColorRampToCollection(global, colorNames.warning,   colors.warning);
  const neutral   = addColorRampToCollection(global, colorNames.neutral,   colors.neutral);

  createPaintStylesForColors(colors, colorNames);

  // ── Global: spacing, borderRadius, borderWidth, typography ──
  const spacingScale = generateSpacingScale(spacingBase);
  for (const [key, val] of Object.entries(spacingScale)) createNumber(global, `spacing/${key}`, val);

  const radiusScale = generateRadiusScale(radiusBase);
  const radiusGlobal = new Map();
  for (const [, val] of Object.entries(radiusScale)) {
    if (!radiusGlobal.has(val)) radiusGlobal.set(val, createNumber(global, `borderRadius/${val}`, val));
  }

  const widthScale = generateBorderWidthScale(widthBase);
  const widthGlobal = new Map();
  for (const [, val] of Object.entries(widthScale)) {
    if (!widthGlobal.has(val)) widthGlobal.set(val, createNumber(global, `borderWidth/${val}`, val));
  }

  const typoScale = generateTypographyScale(fontBase, ratioKey);
  const fsVars = {}, lhVars = {}, lsVars = {}, psVars = {};
  for (const t of typoScale) {
    fsVars[t.name] = createNumber(global, `typography/fontSize/${t.name}`,         t.fontSize);
    lhVars[t.name] = createNumber(global, `typography/lineHeight/${t.name}`,       t.lineHeight);
    lsVars[t.name] = createNumber(global, `typography/letterSpacing/${t.name}`,    t.letterSpacing);
    psVars[t.name] = createNumber(global, `typography/paragraphSpacing/${t.name}`, t.paragraphSpacing);
  }
  await createTextStylesForScale(typoScale, fsVars, lhVars, lsVars, psVars);

  // ── Alias: brand role bridges first ──
  const roleVars = {};
  const brandOrder = ['primary', 'secondary', 'accent'];
  if (hasTertiary) brandOrder.splice(2, 0, 'tertiary');
  const brandRamps = { primary: primary, secondary: secondary, accent: accent };
  if (hasTertiary) brandRamps.tertiary = tertiary;
  for (var bi = 0; bi < brandOrder.length; bi++) {
    var bk = brandOrder[bi];
    if (!brandRamps[bk]) continue;
    roleVars[bk] = {};
    for (const stop of RAMP_STOPS) roleVars[bk][stop] = alias(aliasCol, `color/${bk}/${stop}`, brandRamps[bk][stop]);
  }
  // ── Alias: semantic role bridges second ──
  const semOrder = ['info', 'success', 'error', 'warning', 'neutral'];
  const semRamps = { info: info, success: success, error: error, warning: warning, neutral: neutral };
  for (var si = 0; si < semOrder.length; si++) {
    var sk = semOrder[si];
    if (!semRamps[sk]) continue;
    roleVars[sk] = {};
    for (const stop of RAMP_STOPS) roleVars[sk][stop] = alias(aliasCol, `color/${sk}/${stop}`, semRamps[sk][stop]);
  }

  // ── Alias: spacing, borderRadius, borderWidth, typography ──
  const allVars = figma.variables.getLocalVariables();
  const findVar = (name) => allVars.find(v => v.name === name);
  const sp = (mult) => findVar(`spacing/${spacingBase * mult}`);
  if (sp(1))  alias(aliasCol, 'spacing/xs', sp(1));
  if (sp(2))  alias(aliasCol, 'spacing/sm', sp(2));
  if (sp(4))  alias(aliasCol, 'spacing/md', sp(4));
  if (sp(6))  alias(aliasCol, 'spacing/lg', sp(6));
  if (sp(10)) alias(aliasCol, 'spacing/xl', sp(10));
  for (const [key, val] of Object.entries(radiusScale)) {
    const gVar = radiusGlobal.get(val);
    if (gVar) alias(aliasCol, `borderRadius/${key}`, gVar);
  }
  for (const [key, val] of Object.entries(widthScale)) {
    const gVar = widthGlobal.get(val);
    if (gVar) alias(aliasCol, `borderWidth/${key}`, gVar);
  }
  for (const t of typoScale) {
    alias(aliasCol, `text/${t.name}/fontSize`,         fsVars[t.name]);
    alias(aliasCol, `text/${t.name}/lineHeight`,       lhVars[t.name]);
    alias(aliasCol, `text/${t.name}/letterSpacing`,    lsVars[t.name]);
    alias(aliasCol, `text/${t.name}/paragraphSpacing`, psVars[t.name]);
  }

  // ── Component: text → icon → surface → border → feedback ──
  var rp = roleVars.primary, rs = roleVars.secondary, ra = roleVars.accent,
      rt = roleVars.tertiary, rn = roleVars.neutral,
      ri = roleVars.info, rsu = roleVars.success, re = roleVars.error, rw = roleVars.warning;
  alias(component, 'text/primary',      rp && rp[900]);
  alias(component, 'text/inverse',      rp && rp[50]);
  alias(component, 'text/secondary',    rn && rn[700]);
  alias(component, 'text/disabled',     rn && rn[400]);
  alias(component, 'icon/primary',      rp && rp[900]);
  alias(component, 'icon/inverse',      rp && rp[50]);
  alias(component, 'surface/primary',   rp && rp[500]);
  alias(component, 'surface/secondary', rs && rs[500]);
  if (hasTertiary) alias(component, 'surface/tertiary', rt && rt[500]);
  alias(component, 'surface/accent',    ra && ra[500]);
  alias(component, 'border/default',    rn && rn[200]);
  alias(component, 'feedback/info',           ri  && ri[500]);
  alias(component, 'feedback/info/subtle',    ri  && ri[100]);
  alias(component, 'feedback/success',        rsu && rsu[500]);
  alias(component, 'feedback/success/subtle', rsu && rsu[100]);
  alias(component, 'feedback/error',          re  && re[500]);
  alias(component, 'feedback/error/subtle',   re  && re[100]);
  alias(component, 'feedback/warning',        rw  && rw[500]);
  alias(component, 'feedback/warning/subtle', rw  && rw[100]);
}

async function createFromScratch2Tier(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
  const colorNames = buildColorNameMap(colors);
  const hasTertiary = !!colorNames.tertiary;

  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');

  // ── Global: brand colors first ──
  const primary   = addColorRampToCollection(global, colorNames.primary,   colors.primary);
  const secondary = addColorRampToCollection(global, colorNames.secondary, colors.secondary);
  const tertiary  = hasTertiary ? addColorRampToCollection(global, colorNames.tertiary, colors.tertiary) : null;
  const accent    = addColorRampToCollection(global, colorNames.accent,    colors.accent);

  // ── Global: semantic colors second ──
  const info    = addColorRampToCollection(global, colorNames.info,    colors.info);
  const success = addColorRampToCollection(global, colorNames.success, colors.success);
  const error   = addColorRampToCollection(global, colorNames.error,   colors.error);
  const warning = addColorRampToCollection(global, colorNames.warning, colors.warning);
  const neutral = addColorRampToCollection(global, colorNames.neutral, colors.neutral);

  createPaintStylesForColors(colors, colorNames);

  // ── Global: spacing, borderRadius, borderWidth, typography ──
  const spacingScale = generateSpacingScale(spacingBase);
  for (const [key, val] of Object.entries(spacingScale)) createNumber(global, `spacing/${key}`, val);

  const radiusScale = generateRadiusScale(radiusBase);
  const radiusGlobal = new Map();
  for (const [, val] of Object.entries(radiusScale)) {
    if (!radiusGlobal.has(val)) radiusGlobal.set(val, createNumber(global, `borderRadius/${val}`, val));
  }

  const widthScale = generateBorderWidthScale(widthBase);
  const widthGlobal = new Map();
  for (const [, val] of Object.entries(widthScale)) {
    if (!widthGlobal.has(val)) widthGlobal.set(val, createNumber(global, `borderWidth/${val}`, val));
  }

  const typoScale = generateTypographyScale(fontBase, ratioKey);
  const fsVars = {}, lhVars = {}, lsVars = {}, psVars = {};
  for (const t of typoScale) {
    fsVars[t.name] = createNumber(global, `typography/fontSize/${t.name}`,         t.fontSize);
    lhVars[t.name] = createNumber(global, `typography/lineHeight/${t.name}`,       t.lineHeight);
    lsVars[t.name] = createNumber(global, `typography/letterSpacing/${t.name}`,    t.letterSpacing);
    psVars[t.name] = createNumber(global, `typography/paragraphSpacing/${t.name}`, t.paragraphSpacing);
  }
  await createTextStylesForScale(typoScale, fsVars, lhVars, lsVars, psVars);

  // ── Alias: brand role bridges first ──
  const brandOrder = ['primary', 'secondary'];
  if (hasTertiary) brandOrder.push('tertiary');
  brandOrder.push('accent');
  const brandRamps = { primary, secondary, accent };
  if (tertiary) brandRamps.tertiary = tertiary;

  const roleVars = {};
  for (var bi = 0; bi < brandOrder.length; bi++) {
    var bKey = brandOrder[bi];
    var bRamp = brandRamps[bKey];
    if (!bRamp) continue;
    roleVars[bKey] = {};
    for (const stop of RAMP_STOPS) {
      roleVars[bKey][stop] = alias(aliasCol, `color/${bKey}/${stop}`, bRamp[stop]);
    }
  }

  // ── Alias: semantic role bridges second ──
  const semanticOrder = ['info', 'success', 'error', 'warning', 'neutral'];
  const semanticRamps = { info, success, error, warning, neutral };
  for (var si = 0; si < semanticOrder.length; si++) {
    var sKey = semanticOrder[si];
    var sRamp = semanticRamps[sKey];
    if (!sRamp) continue;
    roleVars[sKey] = {};
    for (const stop of RAMP_STOPS) {
      roleVars[sKey][stop] = alias(aliasCol, `color/${sKey}/${stop}`, sRamp[stop]);
    }
  }

  // ── Alias: spacing, borderRadius, borderWidth, typography ──
  const allVars = figma.variables.getLocalVariables();
  const findVar = (name) => allVars.find(v => v.name === name);
  const sp = (mult) => findVar(`spacing/${spacingBase * mult}`);
  if (sp(1))  alias(aliasCol, 'spacing/xs', sp(1));
  if (sp(2))  alias(aliasCol, 'spacing/sm', sp(2));
  if (sp(4))  alias(aliasCol, 'spacing/md', sp(4));
  if (sp(6))  alias(aliasCol, 'spacing/lg', sp(6));
  if (sp(10)) alias(aliasCol, 'spacing/xl', sp(10));
  for (const [key, val] of Object.entries(radiusScale)) {
    const gVar = radiusGlobal.get(val);
    if (gVar) alias(aliasCol, `borderRadius/${key}`, gVar);
  }
  for (const [key, val] of Object.entries(widthScale)) {
    const gVar = widthGlobal.get(val);
    if (gVar) alias(aliasCol, `borderWidth/${key}`, gVar);
  }
  for (const t of typoScale) {
    alias(aliasCol, `text/${t.name}/fontSize`,         fsVars[t.name]);
    alias(aliasCol, `text/${t.name}/lineHeight`,       lhVars[t.name]);
    alias(aliasCol, `text/${t.name}/letterSpacing`,    lsVars[t.name]);
    alias(aliasCol, `text/${t.name}/paragraphSpacing`, psVars[t.name]);
  }
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

async function runGeneration(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
  if (tokensExist()) {
    figma.ui.postMessage({ type: 'confirm-replace' }); return;
  }
  await generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey);
}

async function generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey) {
  deleteAllCollections();
  if (mode === 'scratch') {
    if (approach === '3tier') await createFromScratch3Tier(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey);
    else await createFromScratch2Tier(colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey);
  } else if (approach === '3tier') {
    if (mode === 'starter') await createStarterSystem();
    if (mode === 'convert') convertStylesToTokens();
  } else {
    if (mode === 'starter') await createStarterSystem2Tier();
    if (mode === 'convert') convertStylesToTokens2Tier();
  }
  const json  = exportVariablesToJSON();
  const total = figma.variables.getLocalVariables().length;
  const cols  = figma.variables.getLocalVariableCollections().length;
  figma.notify('✅ Done!');
  figma.ui.postMessage({ type: 'generation-complete', json, total, cols });
}

// ─── MESSAGES ────────────────────────────────────────────────────

figma.ui.onmessage = async (msg) => {
  try {
  if (msg.type === 'generate') {
    await runGeneration(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase || 1, msg.fontBase, msg.ratioKey);
  }
  if (msg.type === 'confirm-continue') {
    await generate(msg.approach, msg.mode, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase || 1, msg.fontBase, msg.ratioKey);
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
  } catch (err) {
    figma.notify('❌ Error: ' + (err && err.message ? err.message : String(err)));
    figma.ui.postMessage({ type: 'generation-error', message: err && err.message ? err.message : String(err) });
  }
};
