import {
  RampStop, RAMP_STOPS, STARTER_COLORS, TypeLevel, RGB,
  hexToRgb, rgbToHsl, hslToRgb, rgbToHex, generateColorRamp, generateTypographyScale,
  generateSpacingScale, generateRadiusScale, generateBorderWidthScale, getColorName,
} from './algorithms';

figma.showUI(__html__, { width: 560, height: 510 });

// ─── TYPES ───────────────────────────────────────────────────────

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

// Non-fatal problems collected during a run and shown on the done screen.
const issues = new Map<string, number>();
function warn(message: string): void {
  issues.set(message, (issues.get(message) ?? 0) + 1);
}
function collectIssues(): string[] {
  return Array.from(issues.entries()).map(([m, n]) => (n > 1 ? `${m} (×${n})` : m));
}

function createColor(
  collection: VariableCollection,
  name: string,
  r: number, g: number, b: number
): Variable {
  const v = figma.variables.createVariable(name, collection.id, 'COLOR');
  v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
  return v;
}

function createLocalPaintStyle(path: string, r: number, g: number, b: number): void {
  try {
    const style = figma.createPaintStyle();
    style.name = path;
    const paint: SolidPaint = { type: 'SOLID', color: { r, g, b }, opacity: 1 };
    style.paints = [paint];
  } catch (_e) {
    warn(`Couldn't create a color style`);
  }
}

async function createLocalTextStyle(path: string, fontSize: number, lineHeight: number, letterSpacing: number, fontFamily: string): Promise<void> {
  try {
    await figma.loadFontAsync({ family: fontFamily, style: 'Regular' });
    const style = figma.createTextStyle();
    style.name = path;
    style.fontSize = fontSize;
    style.fontName = { family: fontFamily, style: 'Regular' };
    style.lineHeight = { unit: 'PIXELS', value: lineHeight };
    style.letterSpacing = { unit: 'PIXELS', value: letterSpacing };
  } catch (_e) {
    // Font not available, try system fallback
    try {
      warn(`Font "${fontFamily}" unavailable, used Helvetica for text styles`);
      await figma.loadFontAsync({ family: 'Helvetica', style: 'Regular' });
      const style = figma.createTextStyle();
      style.name = path;
      style.fontSize = fontSize;
      style.fontName = { family: 'Helvetica', style: 'Regular' };
      style.lineHeight = { unit: 'PIXELS', value: lineHeight };
      style.letterSpacing = { unit: 'PIXELS', value: letterSpacing };
    } catch (_e2) {
      warn(`Couldn't create a text style (no usable font)`);
    }
  }
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
      if (v.variableCollectionId === col.id) {
        try { v.remove(); } catch (_e) { warn(`Couldn't remove an existing variable`); }
      }
    });
    try { col.remove(); } catch (_e) { warn(`Couldn't remove collection "${col.name}"`); }
  });
}

function deleteAllLocalStyles(): void {
  figma.getLocalPaintStyles().forEach(style => {
    try { style.remove(); } catch (_e) { warn(`Couldn't remove an existing color style`); }
  });
  figma.getLocalTextStyles().forEach(style => {
    try { style.remove(); } catch (_e) { warn(`Couldn't remove an existing text style`); }
  });
}

function tokensExist(): boolean {
  return figma.variables.getLocalVariableCollections().length > 0;
}

// What a replace would delete, so the UI can show it before the user confirms.
function describeExisting(mode: string): {
  collections: { name: string; variables: number }[];
  paintStyles: number;
  textStyles: number;
} {
  const vars = figma.variables.getLocalVariables();
  return {
    collections: figma.variables.getLocalVariableCollections().map(c => ({
      name: c.name,
      variables: vars.filter(v => v.variableCollectionId === c.id).length,
    })),
    // Smart Convert reads the local styles, so they are kept.
    paintStyles: mode === 'convert' ? 0 : figma.getLocalPaintStyles().length,
    textStyles:  mode === 'convert' ? 0 : figma.getLocalTextStyles().length,
  };
}

// ─── STARTER + SMART CONVERT ─────────────────────────────────────

type Tier = '2tier' | '3tier';

async function createStarterSystem(tier: Tier): Promise<void> {
  return buildFromScratch(STARTER_COLORS, 4, 4, 1, 16, 'major-third', tier);
}

// Smart Convert reads the local paint/text styles and rebuilds them as variables.
// 3-tier adds a Component collection and names the alias colors `colors/…`;
// 2-tier names them `color/…`. Both names are kept so existing output doesn't change.
function convertStylesToTokens(tier: Tier): void {
  const colorStyles = figma.getLocalPaintStyles();
  const textStyles  = figma.getLocalTextStyles();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    warn('No local styles found to convert'); figma.notify('⚠️ No styles found'); return;
  }

  const global   = figma.variables.createVariableCollection('01 Global');
  const aliasCol = figma.variables.createVariableCollection('02 Alias');
  const component = tier === '3tier' ? figma.variables.createVariableCollection('03 Component') : undefined;
  const modeId = global.modes[0].modeId;
  const aliasModeId = aliasCol.modes[0].modeId;
  const aliasColorRoot = tier === '3tier' ? 'colors' : 'color';

  const globalColors: Array<{ name: string; brightness: number; variable: Variable }> = [];

  colorStyles.forEach(style => {
    const paint = style.paints[0];
    if (!paint || paint.type !== 'SOLID') return;
    const name = style.name.replace(/\s+/g, '-').toLowerCase();
    // Parse "color-50" into "color" and "50" to create "color/color/50"
    const match = name.match(/^(.+?)(-\d+)$/);
    const varName = match ? `color/${match[1]}/${match[2].substring(1)}` : `color/${name}`;
    const v = figma.variables.createVariable(varName, global.id, 'COLOR');
    v.setValueForMode(modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
    globalColors.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
  });

  if (globalColors.length === 0) {
    warn('No solid color styles found to convert'); figma.notify('⚠️ No paint styles found'); return;
  }

  const allGlobalVars = figma.variables.getLocalVariables()
    .filter(v => v.variableCollectionId === global.id && v.name.startsWith('color/'));

  // Group "color/red/50", "color/red/100", … by family ("red")
  const colorFamilies = new Map<string, Variable[]>();
  allGlobalVars.forEach(gVar => {
    const parts = gVar.name.split('/');
    if (parts.length >= 2) {
      const baseColor = parts[1];
      if (!colorFamilies.has(baseColor)) colorFamilies.set(baseColor, []);
      colorFamilies.get(baseColor)!.push(gVar);
    }
  });

  const sortedFamilies = Array.from(colorFamilies.entries()).sort((a, b) => {
    const aBrightness = a[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
    const bBrightness = b[1].reduce((sum, v) => sum + (v.name.endsWith('-500') ? 1 : 0), 0);
    return aBrightness - bBrightness;
  });

  type Family = [string, Variable[]];
  const primaryFamily   = sortedFamilies[Math.floor(sortedFamilies.length / 2)];
  const secondaryFamily = sortedFamilies[Math.floor(sortedFamilies.length / 4)];
  const tertiaryFamily  = sortedFamilies[Math.floor(sortedFamilies.length * 3 / 4)];
  const accentFamily    = sortedFamilies[sortedFamilies.length - 1];
  const darkestFamily   = sortedFamilies[0];
  const lightestFamily  = sortedFamilies[sortedFamilies.length - 1];

  // Alias every stop of a global color family under `<root>/<role>/<stop>`.
  const aliasFamily = (family: Family | undefined, role: string): void => {
    if (!family) return;
    family[1].forEach(gVar => {
      const suffix = gVar.name.substring(`color/${family[0]}`.length);
      const a = figma.variables.createVariable(`${aliasColorRoot}/${role}${suffix}`, aliasCol.id, 'COLOR');
      a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
    });
  };

  try {
    aliasFamily(primaryFamily,   'primary');
    aliasFamily(secondaryFamily, 'secondary');
    aliasFamily(tertiaryFamily,  'tertiary');
    aliasFamily(accentFamily,    'accent');
    // Feedback: darkest family stands in for info + error, lightest for success, primary for warning
    aliasFamily(darkestFamily, 'feedback/info');
    aliasFamily(darkestFamily, 'feedback/error');
    if (lightestFamily !== darkestFamily) aliasFamily(lightestFamily, 'feedback/success');
    aliasFamily(primaryFamily, 'feedback/warning');
  } catch (e) {
    warn(`Color aliases were not fully created: ${e}`);
    figma.notify(`❌ Color aliases: ${e}`);
    return;
  }

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

  if (component) {
    try {
      createComponentColorTokens(aliasCol, component, aliasColorRoot);
    } catch (e) {
      warn(`Component variables were not fully created: ${e}`);
      figma.notify(`❌ Component vars: ${e}`);
      return;
    }
  }

  figma.notify('✅ Typography + color tokens created!');
}

// Component-tier color tokens that point at the 500 stop of each alias role.
function createComponentColorTokens(aliasCol: VariableCollection, component: VariableCollection, root: string): void {
  const modeId = component.modes[0].modeId;
  const aliasVars = figma.variables.getLocalVariables().filter(v => v.variableCollectionId === aliasCol.id);
  const stop500 = (role: string) => aliasVars.find(v => v.name === `${root}/${role}/500`);
  const make = (name: string, target: Variable): void => {
    const v = figma.variables.createVariable(name, component.id, 'COLOR');
    v.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: target.id });
  };

  const primary = stop500('primary'), secondary = stop500('secondary');
  const tertiary = stop500('tertiary'), accent = stop500('accent');

  if (primary) ['text/primary', 'icon/primary', 'surface/primary', 'border/default'].forEach(n => make(n, primary));
  if (secondary) make('surface/secondary', secondary);
  if (tertiary)  make('surface/tertiary', tertiary);
  if (accent)    ['surface/accent', 'text/inverse', 'icon/inverse'].forEach(n => make(n, accent));
}

// ─── FROM SCRATCH ─────────────────────────────────────────────────

const BRAND_KEYS    = ['primary', 'secondary', 'tertiary', 'accent'] as const;
const SEMANTIC_KEYS = ['info', 'success', 'error', 'warning', 'neutral'] as const;

// Semantic colors keep fixed color words so they never collide with hue-derived brand names.
const SEMANTIC_GLOBAL: Record<typeof SEMANTIC_KEYS[number], string> = {
  info: 'blue', success: 'green', error: 'red', warning: 'amber', neutral: 'grey',
};

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

type Ramps = Record<string, Record<number, Variable>>;
type AliasRamps = Record<string, Record<number, Variable | undefined>>;

interface ScaleVars {
  entries: [string, number][];
  byValue: Map<number, Variable>;
}

interface TypographyVars {
  levels: TypeLevel[];
  fontSize: Record<string, Variable>;
  lineHeight: Record<string, Variable>;
  letterSpacing: Record<string, Variable>;
  fontFamily: Variable;
}

function lineHeightPx(t: TypeLevel): number {
  return Math.round(t.fontSize * t.lineHeight / 4) * 4;
}

function createRampVariables(global: VariableCollection, hex: string, colorName: string): Record<number, Variable> {
  const ramp = generateColorRamp(hex);
  const vars: Record<number, Variable> = {};
  for (const stop of RAMP_STOPS) {
    const { r, g, b } = ramp[stop];
    vars[stop] = createColor(global, `color/${colorName}/${stop}`, r, g, b);
  }
  return vars;
}

// Brand colors get hue-derived names (de-duplicated); semantic colors get fixed words.
function createGlobalColors(
  global: VariableCollection,
  colors: ScratchColors
): { ramps: Ramps; brandNames: Record<string, string> } {
  const ramps: Ramps = {};
  const brandNames: Record<string, string> = {};
  const used = new Set<string>();

  for (const key of BRAND_KEYS) {
    const hex = colors[key];
    if (!hex || !HEX_RE.test(hex)) continue;
    let name = getColorName(hex);
    if (used.has(name)) {
      let i = 2;
      while (used.has(`${name}-${i}`)) i++;
      name = `${name}-${i}`;
    }
    used.add(name);
    brandNames[key] = name;
    ramps[key] = createRampVariables(global, hex, name);
  }

  for (const key of SEMANTIC_KEYS) {
    const hex = colors[key];
    if (!hex || !HEX_RE.test(hex)) continue;
    ramps[key] = createRampVariables(global, hex, SEMANTIC_GLOBAL[key]);
  }

  return { ramps, brandNames };
}

function createSpacingVariables(global: VariableCollection, base: number): void {
  for (const [k, v] of Object.entries(generateSpacingScale(base))) {
    createNumber(global, `spacing/${k}`, v);
  }
}

// Radius and border-width globals are named by pixel value; duplicate values share one variable.
function createScaleGlobals(global: VariableCollection, prefix: string, scale: Record<string, number>): ScaleVars {
  const entries = Object.entries(scale) as [string, number][];
  const byValue = new Map<number, Variable>();
  for (const [, v] of entries) {
    if (!byValue.has(v)) byValue.set(v, createNumber(global, `${prefix}/${v}`, v));
  }
  return { entries, byValue };
}

function createTypographyVariables(
  global: VariableCollection,
  fontBase: number,
  ratioKey: string,
  font: string
): TypographyVars {
  const levels = generateTypographyScale(fontBase, ratioKey);
  const fontFamily = figma.variables.createVariable('typography/font-family', global.id, 'STRING');
  fontFamily.setValueForMode(global.modes[0].modeId, font);

  const fontSize: Record<string, Variable> = {};
  const lineHeight: Record<string, Variable> = {};
  const letterSpacing: Record<string, Variable> = {};
  for (const t of levels) {
    fontSize[t.name]      = createNumber(global, `typography/font-size/${t.name}`,      t.fontSize);
    lineHeight[t.name]    = createNumber(global, `typography/line-height/${t.name}`,    lineHeightPx(t));
    letterSpacing[t.name] = createNumber(global, `typography/letter-spacing/${t.name}`, t.letterSpacing);
  }
  return { levels, fontSize, lineHeight, letterSpacing, fontFamily };
}

function aliasScale(aliasCol: VariableCollection, prefix: string, scale: ScaleVars): void {
  for (const [k, v] of scale.entries) {
    const gVar = scale.byValue.get(v);
    if (gVar) alias(aliasCol, `${prefix}/${k}`, gVar);
  }
}

// 02 Alias: every color stop, radius, border width and text level, pointing at 01 Global.
function createAliasCollection(
  ramps: Ramps,
  radius: ScaleVars,
  width: ScaleVars,
  typo: TypographyVars
): { aliasCol: VariableCollection; colorAliases: AliasRamps } {
  const aliasCol = figma.variables.createVariableCollection('02 Alias');
  const colorAliases: AliasRamps = {};

  const aliasRamp = (key: string, prefix: string): void => {
    const R = ramps[key];
    if (!R) return;
    colorAliases[key] = {};
    for (const stop of RAMP_STOPS) colorAliases[key][stop] = alias(aliasCol, `${prefix}/${stop}`, R[stop]);
  };
  for (const key of BRAND_KEYS)    aliasRamp(key, `color/${key}`);
  for (const key of SEMANTIC_KEYS) aliasRamp(key, `color/feedback/${key}`);

  aliasScale(aliasCol, 'borderRadius', radius);
  aliasScale(aliasCol, 'borderWidth', width);

  alias(aliasCol, 'typography/font-family', typo.fontFamily);
  for (const t of typo.levels) {
    alias(aliasCol, `text/${t.name}/font-size`,      typo.fontSize[t.name]);
    alias(aliasCol, `text/${t.name}/line-height`,    typo.lineHeight[t.name]);
    alias(aliasCol, `text/${t.name}/letter-spacing`, typo.letterSpacing[t.name]);
  }
  return { aliasCol, colorAliases };
}

function textStyleGroup(levelName: string): string {
  if (['display-lg', 'display-md', 'display-sm'].includes(levelName)) return 'Display';
  if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(levelName)) return 'Heading';
  if (['body-lg', 'body', 'caption', 'xs'].includes(levelName)) return 'Body copy';
  return '';
}

// Local text styles for each level, then bound to the typography variables.
async function createTextStyles(typo: TypographyVars, font: string): Promise<void> {
  for (const t of typo.levels) {
    const group = textStyleGroup(t.name);
    if (!group) continue;
    await createLocalTextStyle(`${group}/${t.name}`, t.fontSize, lineHeightPx(t), t.fontSize * t.letterSpacing, font);
  }

  for (const style of figma.getLocalTextStyles()) {
    const levelName = style.name.split('/').pop();
    if (!levelName || !typo.fontSize[levelName]) continue;
    try {
      style.setBoundVariable('fontSize', typo.fontSize[levelName]);
      style.setBoundVariable('lineHeight', typo.lineHeight[levelName]);
      style.setBoundVariable('letterSpacing', typo.letterSpacing[levelName]);
      style.setBoundVariable('fontFamily', typo.fontFamily);
    } catch (_e) {
      warn(`Couldn't link a text style to its variables`);
    }
  }
}

// Local paint styles mirroring each color ramp (brand names from the global step, semantic fixed).
function createPaintStyles(global: VariableCollection, ramps: Ramps, brandNames: Record<string, string>): void {
  const modeId = global.modes[0].modeId;
  const styleRamp = (key: string, name: string): void => {
    const R = ramps[key];
    if (!R) return;
    for (const stop of RAMP_STOPS) {
      const val = R[stop].valuesByMode[modeId];
      if (val && typeof val === 'object' && 'r' in val) {
        const rgb = val as { r: number; g: number; b: number };
        createLocalPaintStyle(`${name}/${stop}`, rgb.r, rgb.g, rgb.b);
      }
    }
  };
  for (const key of BRAND_KEYS)    if (brandNames[key]) styleRamp(key, brandNames[key]);
  for (const key of SEMANTIC_KEYS) styleRamp(key, SEMANTIC_GLOBAL[key]);
}

// 03 Component: text, icon, surface and border tokens that point at the alias colors.
function createComponentCollection(colorAliases: AliasRamps): void {
  const comp = figma.variables.createVariableCollection('03 Component');
  const primary = colorAliases['primary'];

  if (primary) {
    alias(comp, 'text/default',  primary[900]);
    alias(comp, 'text/subtle',   primary[600]);
    alias(comp, 'text/disabled', primary[400]);
    alias(comp, 'text/inverse',  primary[50]);

    alias(comp, 'icon/default',  primary[900]);
    alias(comp, 'icon/subtle',   primary[600]);
    alias(comp, 'icon/disabled', primary[400]);
    alias(comp, 'icon/inverse',  primary[50]);
  }

  // Surfaces map each brand role's 500 stop, and only exist when all four brand colors do.
  const { secondary, tertiary, accent } = colorAliases;
  if (primary && secondary && tertiary && accent) {
    alias(comp, 'surface/primary',   primary[500]);
    alias(comp, 'surface/secondary', secondary[500]);
    alias(comp, 'surface/tertiary',  tertiary[500]);
    alias(comp, 'surface/accent',    accent[500]);
  }

  if (primary) {
    alias(comp, 'border/default',  primary[500]);
    alias(comp, 'border/subtle',   primary[300]);
    alias(comp, 'border/disabled', primary[100]);
    alias(comp, 'border/inverse',  primary[900]);
  }
}

async function buildFromScratch(
  colors: ScratchColors,
  spacingBase: number,
  radiusBase: number,
  widthBase: number,
  fontBase: number,
  ratioKey: string,
  tier: Tier,
  fontFamily?: string
): Promise<void> {
  const font = fontFamily || 'Inter';

  // 01 Global
  const global = figma.variables.createVariableCollection('01 Global');
  const { ramps, brandNames } = createGlobalColors(global, colors);
  createSpacingVariables(global, spacingBase);
  const radius = createScaleGlobals(global, 'borderRadius', generateRadiusScale(radiusBase));
  const width  = createScaleGlobals(global, 'borderWidth', generateBorderWidthScale(widthBase));
  const typo   = createTypographyVariables(global, fontBase, ratioKey, font);

  // 02 Alias, then the local styles that mirror the tokens
  const { colorAliases } = createAliasCollection(ramps, radius, width, typo);
  await createTextStyles(typo, font);
  createPaintStyles(global, ramps, brandNames);

  // 03 Component
  if (tier === '3tier') createComponentCollection(colorAliases);
}

// ─── JSON EXPORT ─────────────────────────────────────────────────

function exportVariablesToJSON(): string {
  const collections = figma.variables.getLocalVariableCollections();
  const allVars = figma.variables.getLocalVariables();
  const result: { [key: string]: unknown } = {};
  const toCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  const colorToHex = (c: { r: number; g: number; b: number }) => {
    const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
  };

  // Build lookup map: varId -> { name, collectionName, token }
  const varLookup = new Map<string, { name: string; collectionName: string; token: string }>();
  const collectionNames = new Map<string, string>();

  collections.forEach(col => {
    collectionNames.set(col.id, toCamelCase(col.name));
  });

  allVars.forEach(v => {
    const colName = collectionNames.get(v.variableCollectionId) || 'unknown';
    const token = v.name.split('/').map(p => toCamelCase(p)).join('.');
    varLookup.set(v.id, { name: v.name, collectionName: colName, token: `${colName}.${token}` });
  });

  // Process typography groups per collection
  const typographyGroupsByCollection = new Map<string, Map<string, { fontSize?: number; lineHeight?: number; letterSpacing?: number }>>();

  allVars.forEach(v => {
    if (v.name.includes('/fontSize/') || v.name.includes('/lineHeight/') || v.name.includes('/letterSpacing/')) {
      const match = v.name.match(/^text\/([^/]+)\/(fontSize|lineHeight|letterSpacing)$/);
      if (match) {
        const colId = v.variableCollectionId;
        const colName = collectionNames.get(colId) || 'unknown';
        const baseKey = match[1];

        if (!typographyGroupsByCollection.has(colName)) {
          typographyGroupsByCollection.set(colName, new Map());
        }

        const groupMap = typographyGroupsByCollection.get(colName)!;
        if (!groupMap.has(baseKey)) groupMap.set(baseKey, {});

        const mode = figma.variables.getLocalVariableCollections().find(c => c.id === colId)?.modes[0];
        if (mode) {
          const val = v.valuesByMode[mode.modeId];
          const group = groupMap.get(baseKey)!;
          if (match[2] === 'fontSize') group.fontSize = val as number;
          else if (match[2] === 'lineHeight') group.lineHeight = val as number;
          else if (match[2] === 'letterSpacing') group.letterSpacing = val as number;
        }
      }
    }
  });

  // Process collections
  collections.forEach(col => {
    const colName = toCamelCase(col.name);
    const colResult: { [key: string]: unknown } = {};
    const vars = allVars.filter(v => v.variableCollectionId === col.id);
    const mode = col.modes[0];

    vars.forEach(v => {
      // Skip individual typography components (handled as groups)
      if (v.name.includes('/fontSize/') || v.name.includes('/lineHeight/') || v.name.includes('/letterSpacing/')) {
        return;
      }

      const val = v.valuesByMode[mode.modeId];
      const parts = v.name.split('/');
      let current: any = colResult;

      // Navigate/create nested structure within collection
      for (let i = 0; i < parts.length - 1; i++) {
        const key = toCamelCase(parts[i]);
        if (!current[key]) current[key] = {};
        current = current[key];
      }

      const lastKey = toCamelCase(parts[parts.length - 1]);
      let type = 'unknown';
      let value: any = val;

      if (v.resolvedType === 'COLOR' && val && typeof val === 'object' && (val as any).r !== undefined) {
        value = colorToHex(val as any);
        type = 'color';
      } else if (typeof val === 'object' && (val as any).type === 'VARIABLE_ALIAS') {
        // Resolve alias to {collection.path.to.token} format
        const aliasId = (val as any).id;
        const aliasVar = varLookup.get(aliasId);
        if (aliasVar) {
          value = `{${aliasVar.token}}`;
          type = 'color';
        }
      } else if (v.resolvedType === 'FLOAT') {
        value = val;
        type = 'dimension';
      }

      current[lastKey] = { value, type };
    });

    // Add typography composite tokens for this collection
    const typographyGroups = typographyGroupsByCollection.get(colName);
    if (typographyGroups) {
      typographyGroups.forEach((group, name) => {
        if (group.fontSize !== undefined) {
          if (!colResult['text']) colResult['text'] = {};
          const textObj = colResult['text'] as { [key: string]: unknown };
          textObj[name] = {
            value: {
              fontSize: group.fontSize,
              lineHeight: group.lineHeight ?? group.fontSize * 1.4,
              letterSpacing: group.letterSpacing ?? 0,
            },
            type: 'typography',
          };
        }
      });
    }

    result[colName] = colResult;
  });

  return JSON.stringify(result, null, 2);
}

// ─── ORCHESTRATION ────────────────────────────────────────────────

// Smart Convert reads local styles; with none, running it would only delete the old tokens.
function blockedReason(mode: string): string | null {
  if (mode === 'convert' && figma.getLocalPaintStyles().length === 0 && figma.getLocalTextStyles().length === 0) {
    return 'No local color or text styles found. Smart Convert needs styles to convert, so nothing was changed.';
  }
  return null;
}

// generate() runs past several awaits and is not awaited by the message handler,
// so a throw would otherwise vanish. Report it to the UI instead.
async function runSafely(run: () => void | Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    const message = (e as { message?: string } | null)?.message ?? String(e);
    figma.notify(`❌ Generation failed: ${message}`, { error: true });
    figma.ui.postMessage({ type: 'generation-failed', message });
  }
}

function runGeneration(
  approach: string,
  mode: string,
  colors?: ScratchColors,
  spacingBase?: number,
  radiusBase?: number,
  widthBase?: number,
  fontBase?: number,
  ratioKey?: string,
  fontFamily?: string
): void {
  const blocked = blockedReason(mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  if (tokensExist()) {
    figma.ui.postMessage({ type: 'confirm-replace', existing: describeExisting(mode) }); return;
  }
  generate(approach, mode, colors, spacingBase, radiusBase, widthBase, fontBase, ratioKey, fontFamily);
}

async function generate(
  approach: string,
  mode: string,
  colors?: ScratchColors,
  spacingBase?: number,
  radiusBase?: number,
  widthBase?: number,
  fontBase?: number,
  ratioKey?: string,
  fontFamily?: string
): Promise<void> {
  const blocked = blockedReason(mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  issues.clear();
  deleteAllCollections();
  if (mode !== 'convert') {
    deleteAllLocalStyles();
  }
  const tier: Tier = approach === '3tier' ? '3tier' : '2tier';
  if (mode === 'scratch') {
    await buildFromScratch(
      colors!, spacingBase!, radiusBase!, widthBase ?? 1,
      fontBase ?? 16, ratioKey ?? 'major-third',
      tier,
      fontFamily
    );
  } else if (mode === 'starter') {
    await createStarterSystem(tier);
  } else if (mode === 'convert') {
    convertStylesToTokens(tier);
  }
  const json  = exportVariablesToJSON();
  const total = figma.variables.getLocalVariables().length;
  const cols  = figma.variables.getLocalVariableCollections().length;
  const warnings = collectIssues();
  figma.notify(warnings.length ? `⚠️ Done with ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : '✅ Done!');
  figma.ui.postMessage({ type: 'generation-complete', json, total, cols, warnings });
}

// ─── MESSAGES ────────────────────────────────────────────────────

figma.ui.onmessage = async (msg: {
  type: string;
  approach?: string;
  mode?: string;
  colors?: ScratchColors;
  spacingBase?: number;
  radiusBase?: number;
  widthBase?: number;
  fontBase?: number;
  ratioKey?: string;
  fontFamily?: string;
}) => {
  if (msg.type === 'generate') {
    runSafely(() => runGeneration(msg.approach!, msg.mode!, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey, msg.fontFamily));
  }
  if (msg.type === 'confirm-continue') {
    runSafely(() => generate(msg.approach!, msg.mode!, msg.colors, msg.spacingBase, msg.radiusBase, msg.widthBase, msg.fontBase, msg.ratioKey, msg.fontFamily));
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
  if (msg.type === 'get-fonts') {
    const fonts = await figma.listAvailableFontsAsync();
    const fontNames = [...new Set(fonts.map((f: Font) => f.fontName.family))].sort();
    figma.ui.postMessage({ type: 'fonts-list', fonts: fontNames });
  }
};
