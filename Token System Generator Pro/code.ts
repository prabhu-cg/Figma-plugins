import {
  RAMP_STOPS, STARTER_COLORS, TypeLevel, TS_RATIO,
  generateColorRamp, generateTypographyScale, generateSpacingScale, generateRadiusScale,
  generateBorderWidthScale, getColorName, pickFontStyle, weightFromStyleName, FONT_WEIGHT_NAMES,
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
  const v = figma.variables.createVariable(name, collection, 'COLOR');
  v.setValueForMode(collection.modes[0].modeId, { r, g, b, a: 1 });
  return v;
}

// ─── ATOMIC GENERATION ───────────────────────────────────────────
// Everything a run creates is "staged": collections carry a temporary name and every
// style is recorded. If the build throws, rollbackStaged() removes it all and the file
// is exactly as it was. Only after the build succeeds are the old tokens removed and
// the staged collections renamed (commitStaged). Old tokens are never touched before then.

const PENDING_PREFIX = '(generating) ';

const staged = {
  collections: [] as { collection: VariableCollection; finalName: string }[],
  styles: [] as BaseStyle[],
};

function stageCollection(name: string): VariableCollection {
  const collection = figma.variables.createVariableCollection(PENDING_PREFIX + name);
  staged.collections.push({ collection, finalName: name });
  return collection;
}

function stageStyle<T extends BaseStyle>(style: T): T {
  staged.styles.push(style);
  return style;
}

// Returns how many staged items could not be removed.
function rollbackStaged(): number {
  let failed = 0;
  for (const style of staged.styles) {
    try { style.remove(); } catch (_e) { failed++; }
  }
  for (const { collection } of staged.collections) {
    try { collection.remove(); } catch (_e) { failed++; }
  }
  staged.styles = [];
  staged.collections = [];
  return failed;
}

interface ExistingTokens {
  collections: VariableCollection[];
  variables: Variable[];
  paintStyles: PaintStyle[];
  textStyles: TextStyle[];
}

async function snapshotExisting(mode: string): Promise<ExistingTokens> {
  return {
    collections: await figma.variables.getLocalVariableCollectionsAsync(),
    variables:   await figma.variables.getLocalVariablesAsync(),
    // Smart Convert reads the local styles, so they are kept.
    paintStyles: mode === 'convert' ? [] : await figma.getLocalPaintStylesAsync(),
    textStyles:  mode === 'convert' ? [] : await figma.getLocalTextStylesAsync(),
  };
}

// The build succeeded: drop what it replaces, then give the new collections their real names.
// Problems here leave a complete new system plus some old leftovers, so they are warnings.
function commitStaged(old: ExistingTokens): void {
  for (const col of old.collections) {
    for (const v of old.variables) {
      if (v.variableCollectionId === col.id) {
        try { v.remove(); } catch (_e) { warn(`Couldn't remove an old variable`); }
      }
    }
    try { col.remove(); } catch (_e) { warn(`Couldn't remove old collection "${col.name}"`); }
  }
  for (const style of old.paintStyles) {
    try { style.remove(); } catch (_e) { warn(`Couldn't remove an old color style`); }
  }
  for (const style of old.textStyles) {
    try { style.remove(); } catch (_e) { warn(`Couldn't remove an old text style`); }
  }
  for (const { collection, finalName } of staged.collections) {
    try { collection.name = finalName; } catch (_e) { warn(`Couldn't rename "${finalName}"`); }
  }
  staged.collections = [];
  staged.styles = [];
}

function createLocalPaintStyle(path: string, r: number, g: number, b: number): void {
  const style = stageStyle(figma.createPaintStyle());
  style.name = path;
  const paint: SolidPaint = { type: 'SOLID', color: { r, g, b }, opacity: 1 };
  style.paints = [paint];
}

// A new text style starts out as Inter Regular, and Figma refuses to change a style whose current
// font isn't loaded, so that starting font must be loaded as well as the one we want. The font is
// switched first; only then are size and spacing written.
const NEW_STYLE_FONT: FontName = { family: 'Inter', style: 'Regular' };

// The styles each installed family offers ("Regular", "Semi Bold", …), read once per run.
// null means the list couldn't be read, so styles are tried by name instead.
let fontCatalog: Promise<Map<string, string[]> | null> | null = null;

function loadFontCatalog(): Promise<Map<string, string[]> | null> {
  if (!fontCatalog) {
    fontCatalog = figma.listAvailableFontsAsync().then(fonts => {
      const byFamily = new Map<string, string[]>();
      for (const { fontName } of fonts) {
        const styles = byFamily.get(fontName.family);
        if (styles) styles.push(fontName.style); else byFamily.set(fontName.family, [fontName.style]);
      }
      return byFamily;
    }, () => null);
  }
  return fontCatalog;
}

const weightName = (w: number): string => FONT_WEIGHT_NAMES[w] ?? String(w);

// Find a font + style that exists and loads: the requested family at the closest available weight,
// otherwise Helvetica. Says so (as warnings) whenever it had to settle for less.
async function resolveTextFont(requested: string, weight: number): Promise<{ font: FontName; exactWeight: boolean; fellBack: boolean }> {
  const catalog = await loadFontCatalog();
  const families = requested === 'Helvetica' ? ['Helvetica'] : [requested, 'Helvetica'];
  for (const family of families) {
    const styles = catalog ? catalog.get(family) : undefined;
    if (catalog && !styles) continue;                       // not installed
    const pick = styles ? pickFontStyle(weight, styles) : null;
    const style = pick ? pick.style : 'Regular';
    try {
      await figma.loadFontAsync({ family, style });
    } catch (_e) {
      continue;
    }
    const fellBack = family !== requested;
    if (fellBack) warn(`Font "${requested}" unavailable, used Helvetica for text styles`);
    if (pick && !pick.exact) warn(`Font "${family}" has no ${weightName(weight)} style, used ${pick.style}`);
    return { font: { family, style }, exactWeight: !!pick && pick.exact, fellBack };
  }
  throw new Error(`No usable font found for "${requested}".`);
}

interface TextStyleSpec {
  path: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  paragraphSpacing: number;
  fontFamily: string;
  fontWeight: number;
}

interface CreatedTextStyle {
  style: TextStyle;
  bindFont: boolean;    // the style uses the requested family, so its font variables apply
  bindWeight: boolean;  // ...and an exact weight match exists, so the weight variable applies
}

async function createLocalTextStyle(spec: TextStyleSpec): Promise<CreatedTextStyle> {
  await figma.loadFontAsync(NEW_STYLE_FONT);
  const { font, exactWeight, fellBack } = await resolveTextFont(spec.fontFamily, spec.fontWeight);
  const style = stageStyle(figma.createTextStyle());
  style.name = spec.path;
  style.fontName = font;
  style.fontSize = spec.fontSize;
  style.lineHeight = { unit: 'PIXELS', value: spec.lineHeight };
  style.letterSpacing = { unit: 'PIXELS', value: spec.letterSpacing };
  style.paragraphSpacing = spec.paragraphSpacing;
  return { style, bindFont: !fellBack, bindWeight: !fellBack && exactWeight };
}

function createNumber(
  collection: VariableCollection,
  name: string,
  value: number
): Variable {
  const v = figma.variables.createVariable(name, collection, 'FLOAT');
  v.setValueForMode(collection.modes[0].modeId, value);
  return v;
}

function alias(
  collection: VariableCollection,
  name: string,
  ref: Variable | undefined
): Variable | undefined {
  if (!ref) return;
  const v = figma.variables.createVariable(name, collection, ref.resolvedType);
  v.setValueForMode(collection.modes[0].modeId, { type: 'VARIABLE_ALIAS', id: ref.id });
  return v;
}

async function tokensExist(): Promise<boolean> {
  return (await figma.variables.getLocalVariableCollectionsAsync()).length > 0;
}

// What a replace would delete, so the UI can show it before the user confirms.
async function describeExisting(mode: string): Promise<{
  collections: { name: string; variables: number }[];
  paintStyles: number;
  textStyles: number;
}> {
  const vars = await figma.variables.getLocalVariablesAsync();
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  return {
    collections: collections.map(c => ({
      name: c.name,
      variables: vars.filter(v => v.variableCollectionId === c.id).length,
    })),
    // Smart Convert reads the local styles, so they are kept.
    paintStyles: mode === 'convert' ? 0 : (await figma.getLocalPaintStylesAsync()).length,
    textStyles:  mode === 'convert' ? 0 : (await figma.getLocalTextStylesAsync()).length,
  };
}

// ─── STARTER + SMART CONVERT ─────────────────────────────────────

type Tier = '2tier' | '3tier';

interface ScratchOptions {
  colors: ScratchColors;
  spacingBase: number;
  radiusBase: number;
  widthBase: number;
  fontBase: number;
  ratioKey: string;
  tier: Tier;
  fontFamily?: string;      // displays + headings (and body copy, unless bodyFontFamily is set)
  bodyFontFamily?: string;  // optional: a different font for body copy
}

async function createStarterSystem(tier: Tier): Promise<void> {
  return buildFromScratch({
    colors: STARTER_COLORS, spacingBase: 4, radiusBase: 4, widthBase: 1,
    fontBase: 16, ratioKey: 'major-third', tier,
  });
}

// Smart Convert reads the local paint/text styles and rebuilds them as variables.
// 3-tier adds a Component collection and names the alias colors `colors/…`;
// 2-tier names them `color/…`. Both names are kept so existing output doesn't change.
async function convertStylesToTokens(tier: Tier): Promise<void> {
  const colorStyles = await figma.getLocalPaintStylesAsync();
  const textStyles  = await figma.getLocalTextStylesAsync();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    throw new Error('No local styles found to convert.');
  }

  const global   = stageCollection('01 Global');
  const aliasCol = stageCollection('02 Alias');
  const component = tier === '3tier' ? stageCollection('03 Component') : undefined;
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
    const v = figma.variables.createVariable(varName, global, 'COLOR');
    v.setValueForMode(modeId, { r: paint.color.r, g: paint.color.g, b: paint.color.b, a: 1 });
    globalColors.push({ name, brightness: paint.color.r + paint.color.g + paint.color.b, variable: v });
  });

  if (globalColors.length === 0) {
    throw new Error('No solid color styles found to convert.');
  }

  // Every variable created above lives under color/, in creation order.
  const allGlobalVars = globalColors.map(c => c.variable);

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
  const aliasByName = new Map<string, Variable>();
  const aliasFamily = (family: Family | undefined, role: string): void => {
    if (!family) return;
    family[1].forEach(gVar => {
      const suffix = gVar.name.substring(`color/${family[0]}`.length);
      const name = `${aliasColorRoot}/${role}${suffix}`;
      const a = figma.variables.createVariable(name, aliasCol, 'COLOR');
      a.setValueForMode(aliasModeId, { type: 'VARIABLE_ALIAS', id: gVar.id });
      if (!aliasByName.has(name)) aliasByName.set(name, a);
    });
  };

  aliasFamily(primaryFamily,   'primary');
  aliasFamily(secondaryFamily, 'secondary');
  aliasFamily(tertiaryFamily,  'tertiary');
  aliasFamily(accentFamily,    'accent');
  // Feedback: darkest family stands in for info + error, lightest for success, primary for warning
  aliasFamily(darkestFamily, 'feedback/info');
  aliasFamily(darkestFamily, 'feedback/error');
  if (lightestFamily !== darkestFamily) aliasFamily(lightestFamily, 'feedback/success');
  aliasFamily(primaryFamily, 'feedback/warning');

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
    const fw = createNumber(global, `typography/fontWeight/${name}`, weightFromStyleName(style.fontName.style) ?? 400);

    alias(aliasCol, `text/${name}/fontSize`,        fs);
    alias(aliasCol, `text/${name}/lineHeight`,       lh);
    alias(aliasCol, `text/${name}/letterSpacing`,    ls);
    alias(aliasCol, `text/${name}/paragraphSpacing`, ps);
    alias(aliasCol, `text/${name}/fontWeight`, fw);
  });

  if (component) createComponentColorTokens(component, aliasByName, aliasColorRoot);
}

// Component-tier color tokens that point at the 500 stop of each alias role.
function createComponentColorTokens(component: VariableCollection, aliasVars: Map<string, Variable>, root: string): void {
  const modeId = component.modes[0].modeId;
  const stop500 = (role: string) => aliasVars.get(`${root}/${role}/500`);
  const make = (name: string, target: Variable): void => {
    const v = figma.variables.createVariable(name, component, 'COLOR');
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
  // One variable when a single font is used (both roles point at it), two when body copy differs.
  paragraphSpacing: Record<string, Variable>;
  fontWeight: Record<string, Variable>; // per level; levels with the same weight share one variable
  fontFamily: { heading: Variable; body: Variable };
  fonts: { heading: string; body: string };
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
  font: string,
  bodyFont?: string
): TypographyVars {
  const levels = generateTypographyScale(fontBase, ratioKey);
  const modeId = global.modes[0].modeId;

  // Choosing the same font twice is the same as choosing one.
  const split = !!bodyFont && bodyFont !== font;
  const makeFont = (name: string, value: string): Variable => {
    const v = figma.variables.createVariable(name, global, 'STRING');
    v.setValueForMode(modeId, value);
    return v;
  };
  const fontFamily = split
    ? { heading: makeFont('typography/font-family/heading', font), body: makeFont('typography/font-family/body', bodyFont as string) }
    : (() => { const v = makeFont('typography/font-family', font); return { heading: v, body: v }; })();
  const fonts = { heading: font, body: split ? (bodyFont as string) : font };

  // Font weights are primitives named by weight (regular, semibold, bold, …) that levels share.
  const weightVars = new Map<number, Variable>();
  for (const w of Array.from(new Set(levels.map(l => l.fontWeight))).sort((a, b) => a - b)) {
    weightVars.set(w, createNumber(global, `typography/font-weight/${weightName(w)}`, w));
  }

  const fontSize: Record<string, Variable> = {};
  const lineHeight: Record<string, Variable> = {};
  const letterSpacing: Record<string, Variable> = {};
  const paragraphSpacing: Record<string, Variable> = {};
  const fontWeight: Record<string, Variable> = {};
  for (const t of levels) {
    fontSize[t.name]         = createNumber(global, `typography/font-size/${t.name}`,         t.fontSize);
    lineHeight[t.name]       = createNumber(global, `typography/line-height/${t.name}`,       lineHeightPx(t));
    letterSpacing[t.name]    = createNumber(global, `typography/letter-spacing/${t.name}`,    t.letterSpacing);
    paragraphSpacing[t.name] = createNumber(global, `typography/paragraph-spacing/${t.name}`, t.paragraphSpacing);
    fontWeight[t.name]       = weightVars.get(t.fontWeight) as Variable;
  }
  return { levels, fontSize, lineHeight, letterSpacing, paragraphSpacing, fontWeight, fontFamily, fonts };
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
  const aliasCol = stageCollection('02 Alias');
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

  if (typo.fontFamily.heading === typo.fontFamily.body) {
    alias(aliasCol, 'typography/font-family', typo.fontFamily.heading);
  } else {
    alias(aliasCol, 'typography/font-family/heading', typo.fontFamily.heading);
    alias(aliasCol, 'typography/font-family/body', typo.fontFamily.body);
  }
  for (const t of typo.levels) {
    alias(aliasCol, `text/${t.name}/font-size`,      typo.fontSize[t.name]);
    alias(aliasCol, `text/${t.name}/line-height`,    typo.lineHeight[t.name]);
    alias(aliasCol, `text/${t.name}/letter-spacing`, typo.letterSpacing[t.name]);
    alias(aliasCol, `text/${t.name}/paragraph-spacing`, typo.paragraphSpacing[t.name]);
    alias(aliasCol, `text/${t.name}/font-weight`, typo.fontWeight[t.name]);
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
// Body copy uses the body font; displays and headings use the heading font.
async function createTextStyles(typo: TypographyVars): Promise<void> {
  fontCatalog = null;
  const created: { made: CreatedTextStyle; level: string; role: 'heading' | 'body' }[] = [];
  for (const t of typo.levels) {
    const group = textStyleGroup(t.name);
    if (!group) continue;
    const role = group === 'Body copy' ? 'body' : 'heading';
    const made = await createLocalTextStyle({
      path: `${group}/${t.name}`, fontSize: t.fontSize, lineHeight: lineHeightPx(t),
      letterSpacing: t.fontSize * t.letterSpacing, paragraphSpacing: t.paragraphSpacing,
      fontFamily: typo.fonts[role], fontWeight: t.fontWeight,
    });
    created.push({ made, level: t.name, role });
  }

  for (const { made, level, role } of created) {
    try {
      const { style } = made;
      style.setBoundVariable('fontSize', typo.fontSize[level]);
      style.setBoundVariable('lineHeight', typo.lineHeight[level]);
      style.setBoundVariable('letterSpacing', typo.letterSpacing[level]);
      style.setBoundVariable('paragraphSpacing', typo.paragraphSpacing[level]);
      // A style that fell back to another font keeps that font instead of pointing at a missing one.
      if (made.bindFont) style.setBoundVariable('fontFamily', typo.fontFamily[role]);
      if (made.bindWeight) style.setBoundVariable('fontWeight', typo.fontWeight[level]);
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
  const comp = stageCollection('03 Component');
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

async function buildFromScratch(o: ScratchOptions): Promise<void> {
  // 01 Global
  const global = stageCollection('01 Global');
  const { ramps, brandNames } = createGlobalColors(global, o.colors);
  createSpacingVariables(global, o.spacingBase);
  const radius = createScaleGlobals(global, 'borderRadius', generateRadiusScale(o.radiusBase));
  const width  = createScaleGlobals(global, 'borderWidth', generateBorderWidthScale(o.widthBase));
  const typo   = createTypographyVariables(global, o.fontBase, o.ratioKey, o.fontFamily || 'Inter', o.bodyFontFamily);

  // 02 Alias, then the local styles that mirror the tokens
  const { colorAliases } = createAliasCollection(ramps, radius, width, typo);
  await createTextStyles(typo);
  createPaintStyles(global, ramps, brandNames);

  // 03 Component
  if (o.tier === '3tier') createComponentCollection(colorAliases);
}

// ─── JSON EXPORT ─────────────────────────────────────────────────

// Token trees are keyed by names that come from the file (variable and collection names), so
// they use prototype-less objects: a variable called "__proto__" is then just another key.
type TokenNode = { [key: string]: unknown };
const newNode = (): TokenNode => Object.create(null) as TokenNode;
const childNode = (parent: TokenNode, key: string): TokenNode => {
  if (!Object.prototype.hasOwnProperty.call(parent, key)) parent[key] = newNode();
  return parent[key] as TokenNode;
};

// Token type follows the variable's own type, so an alias to a font or number isn't mislabelled as a color.
const TOKEN_TYPES: Record<string, string> = { COLOR: 'color', FLOAT: 'dimension', STRING: 'fontFamily', BOOLEAN: 'boolean' };

async function exportVariablesToJSON(): Promise<string> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();
  const result = newNode();
  const toCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  const colorToHex = (c: { r: number; g: number; b: number }) => {
    const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    return `#${h(c.r)}${h(c.g)}${h(c.b)}`.toUpperCase();
  };

  const collectionById = new Map<string, VariableCollection>();
  const collectionNames = new Map<string, string>();
  collections.forEach(col => {
    collectionById.set(col.id, col);
    collectionNames.set(col.id, toCamelCase(col.name));
  });

  // Lookup for resolving aliases: varId -> "collection.path.to.token"
  const varTokens = new Map<string, string>();
  allVars.forEach(v => {
    const colName = collectionNames.get(v.variableCollectionId) || 'unknown';
    varTokens.set(v.id, `${colName}.${v.name.split('/').map(p => toCamelCase(p)).join('.')}`);
  });

  const isTypographyPart = (name: string) =>
    name.includes('/fontSize/') || name.includes('/lineHeight/') || name.includes('/letterSpacing/');

  // Typography groups per collection: text/<level>/{fontSize,lineHeight,letterSpacing}
  type TypeParts = { fontSize?: number; lineHeight?: number; letterSpacing?: number };
  const typographyByCollection = new Map<string, Map<string, TypeParts>>();
  allVars.forEach(v => {
    if (!isTypographyPart(v.name)) return;
    const match = v.name.match(/^text\/([^/]+)\/(fontSize|lineHeight|letterSpacing)$/);
    if (!match) return;
    const colName = collectionNames.get(v.variableCollectionId) || 'unknown';
    if (!typographyByCollection.has(colName)) typographyByCollection.set(colName, new Map());
    const groups = typographyByCollection.get(colName)!;
    if (!groups.has(match[1])) groups.set(match[1], {});
    const mode = collectionById.get(v.variableCollectionId)?.modes[0];
    if (mode) groups.get(match[1])![match[2] as keyof TypeParts] = v.valuesByMode[mode.modeId] as number;
  });

  collections.forEach(col => {
    const colName = toCamelCase(col.name);
    const colResult = childNode(result, colName);
    const mode = col.modes[0];

    allVars.filter(v => v.variableCollectionId === col.id).forEach(v => {
      // Typography parts are emitted as composite tokens below
      if (isTypographyPart(v.name)) return;

      const val = v.valuesByMode[mode.modeId];
      const parts = v.name.split('/');
      let current = colResult;
      for (let i = 0; i < parts.length - 1; i++) current = childNode(current, toCamelCase(parts[i]));

      const type = /(^|\/)(font-weight|fontWeight)(\/|$)/.test(v.name) ? 'fontWeight' : (TOKEN_TYPES[v.resolvedType] ?? 'unknown');
      let value: unknown = val;
      if (v.resolvedType === 'COLOR' && val && typeof val === 'object' && 'r' in val) {
        value = colorToHex(val as { r: number; g: number; b: number });
      } else if (val && typeof val === 'object' && (val as { type?: string }).type === 'VARIABLE_ALIAS') {
        const token = varTokens.get((val as { id: string }).id);
        if (token) value = `{${token}}`;
      }
      current[toCamelCase(parts[parts.length - 1])] = { value, type };
    });

    typographyByCollection.get(colName)?.forEach((group, name) => {
      if (group.fontSize === undefined) return;
      childNode(colResult, 'text')[name] = {
        value: {
          fontSize: group.fontSize,
          lineHeight: group.lineHeight ?? group.fontSize * 1.4,
          letterSpacing: group.letterSpacing ?? 0,
        },
        type: 'typography',
      };
    });
  });

  return JSON.stringify(result, null, 2);
}

// ─── ORCHESTRATION ────────────────────────────────────────────────

// Smart Convert reads local styles; with none, running it would only delete the old tokens.
async function blockedReason(mode: string): Promise<string | null> {
  if (mode === 'convert' && (await figma.getLocalPaintStylesAsync()).length === 0 && (await figma.getLocalTextStylesAsync()).length === 0) {
    return 'No local color or text styles found. Smart Convert needs styles to convert, so nothing was changed.';
  }
  return null;
}

// Thrown by generate() once the build has been rolled back. `leftover` counts staged items
// that could not be removed (0 means the file is exactly as it was before the run).
class GenerationError extends Error {
  leftover: number;
  constructor(message: string, leftover: number) {
    super(message);
    this.leftover = leftover;
  }
}

// The message handler doesn't await generation, so report failures from here instead of losing them.
async function runSafely(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch (e) {
    const err = e as { message?: string; leftover?: number } | null;
    const message = err?.message ?? String(e);
    const leftover = err?.leftover ?? 0;
    figma.notify(`❌ Generation failed: ${message}`, { error: true });
    figma.ui.postMessage({ type: 'generation-failed', message, leftover });
  }
}

async function runGeneration(r: GenerateRequest): Promise<void> {
  const blocked = await blockedReason(r.mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  if (await tokensExist()) {
    figma.ui.postMessage({ type: 'confirm-replace', existing: await describeExisting(r.mode) }); return;
  }
  await generate(r);
}

// parseRequest guarantees these for From Scratch; the check keeps the types honest.
function scratchOptions(r: GenerateRequest): ScratchOptions {
  if (!r.colors || r.spacingBase === undefined || r.radiusBase === undefined || r.widthBase === undefined
      || r.fontBase === undefined || !r.ratioKey) {
    throw new Error('From Scratch settings are incomplete.');
  }
  return {
    colors: r.colors, spacingBase: r.spacingBase, radiusBase: r.radiusBase, widthBase: r.widthBase,
    fontBase: r.fontBase, ratioKey: r.ratioKey, tier: r.approach,
    fontFamily: r.fontFamily, bodyFontFamily: r.bodyFontFamily,
  };
}

// Build everything under staging names first; replace the old tokens only if the whole build worked.
// If it throws, everything staged is removed and the file is left exactly as it was.
async function generate(r: GenerateRequest): Promise<void> {
  const blocked = await blockedReason(r.mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  issues.clear();
  fontCatalog = null;
  const old = await snapshotExisting(r.mode);
  const tier = r.approach;

  try {
    if (r.mode === 'scratch') await buildFromScratch(scratchOptions(r));
    else if (r.mode === 'starter') await createStarterSystem(tier);
    else if (r.mode === 'convert') await convertStylesToTokens(tier);
  } catch (e) {
    const leftover = rollbackStaged();
    const reason = (e as { message?: string } | null)?.message ?? String(e);
    throw new GenerationError(reason, leftover);
  }

  commitStaged(old);

  let json = '';
  try {
    json = await exportVariablesToJSON();
  } catch (_e) {
    warn(`Tokens were created, but the JSON export failed. Use Refresh JSON to retry.`);
  }
  const total = (await figma.variables.getLocalVariablesAsync()).length;
  const cols  = (await figma.variables.getLocalVariableCollectionsAsync()).length;
  const warnings = collectIssues();
  figma.notify(warnings.length ? `⚠️ Done with ${warnings.length} warning${warnings.length > 1 ? 's' : ''}` : '✅ Done!');
  figma.ui.postMessage({ type: 'generation-complete', json, total, cols, warnings });
}

// ─── MESSAGES ────────────────────────────────────────────────────

type Mode = 'scratch' | 'starter' | 'convert';

interface GenerateRequest {
  approach: Tier;
  mode: Mode;
  colors?: ScratchColors;
  spacingBase?: number;
  radiusBase?: number;
  widthBase?: number;
  fontBase?: number;
  ratioKey?: string;
  fontFamily?: string;
  bodyFontFamily?: string; // optional second font for body copy
}

interface UiMessage extends Partial<GenerateRequest> {
  type: string;
}

// Same limits as the inputs on the From Scratch screen.
const LIMITS = {
  spacingBase: { min: 1,  max: 32, label: 'Spacing base unit' },
  radiusBase:  { min: 0,  max: 64, label: 'Border radius base' },
  widthBase:   { min: 1,  max: 16, label: 'Border width base' },
  fontBase:    { min: 10, max: 24, label: 'Base font size' },
} as const;

function intInRange(value: unknown, key: keyof typeof LIMITS): number {
  const { min, max, label } = LIMITS[key];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

// The UI is trusted to be ours, but it is the only input to everything that follows, so check it.
function parseRequest(msg: UiMessage): GenerateRequest {
  if (msg.approach !== '2tier' && msg.approach !== '3tier') throw new Error('Unknown architecture.');
  if (msg.mode !== 'scratch' && msg.mode !== 'starter' && msg.mode !== 'convert') throw new Error('Unknown mode.');
  const request: GenerateRequest = { approach: msg.approach, mode: msg.mode };
  if (msg.mode !== 'scratch') return request;

  const raw = msg.colors as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') throw new Error('Brand colors are missing.');
  const colors = {} as Record<string, string>;
  for (const key of [...BRAND_KEYS, ...SEMANTIC_KEYS]) {
    const hex = raw[key];
    const required = key === 'primary' || key === 'secondary' || key === 'accent';
    if (typeof hex === 'string' && HEX_RE.test(hex)) colors[key] = hex;
    else if (!required && (hex === undefined || hex === '' || hex === '#')) colors[key] = '';
    else throw new Error(`${key[0].toUpperCase()}${key.slice(1)} must be a 6-digit hex color like #3D6BE8.`);
  }
  if (typeof msg.ratioKey !== 'string' || !Object.prototype.hasOwnProperty.call(TS_RATIO, msg.ratioKey)) {
    throw new Error('Unknown type scale ratio.');
  }
  if (typeof msg.fontFamily !== 'string' || !msg.fontFamily || msg.fontFamily.length > 200) {
    throw new Error('Choose a font family.');
  }
  // Optional: blank or missing means one font for everything.
  const body = msg.bodyFontFamily;
  if (body !== undefined && body !== '' && (typeof body !== 'string' || body.length > 200)) {
    throw new Error('Body font is not valid.');
  }
  return {
    ...request,
    bodyFontFamily: body || undefined,
    colors: colors as unknown as ScratchColors,
    spacingBase: intInRange(msg.spacingBase, 'spacingBase'),
    radiusBase:  intInRange(msg.radiusBase, 'radiusBase'),
    widthBase:   intInRange(msg.widthBase, 'widthBase'),
    fontBase:    intInRange(msg.fontBase, 'fontBase'),
    ratioKey: msg.ratioKey,
    fontFamily: msg.fontFamily,
  };
}

// Only one run at a time: staging state is shared, and a second click mid-run would interleave.
let generating = false;

async function exclusive(run: () => Promise<void>): Promise<void> {
  if (generating) { figma.notify('⏳ Still generating — please wait'); return; }
  generating = true;
  figma.ui.postMessage({ type: 'generation-started' });
  try {
    await run();
  } finally {
    generating = false;
  }
}

// Closing the plugin mid-build would leave half-built tokens in the file. Removal is synchronous,
// so it can still run from the close handler.
figma.on('close', () => {
  if (generating) rollbackStaged();
});

figma.ui.onmessage = async (msg: UiMessage) => {
  if (msg.type === 'generate' || msg.type === 'confirm-continue') {
    await exclusive(() => runSafely(async () => {
      const r = parseRequest(msg);
      if (msg.type === 'generate') await runGeneration(r);
      else await generate(r);
    }));
  }
  if (msg.type === 'export-json') {
    if (!(await tokensExist())) { figma.notify('⚠️ No variables found — generate tokens first'); return; }
    try {
      const json  = await exportVariablesToJSON();
      const total = (await figma.variables.getLocalVariablesAsync()).length;
      const cols  = (await figma.variables.getLocalVariableCollectionsAsync()).length;
      figma.ui.postMessage({ type: 'export-ready', json, total, cols });
    } catch (e) {
      figma.notify(`❌ Export failed: ${(e as { message?: string } | null)?.message ?? String(e)}`, { error: true });
    }
  }
  if (msg.type === 'check-tokens') {
    // The UI waits for this reply before showing its first screen, so always send one.
    let status = { exists: false, total: 0, cols: 0 };
    try {
      const exists = await tokensExist();
      status = {
        exists,
        total: exists ? (await figma.variables.getLocalVariablesAsync()).length : 0,
        cols:  exists ? (await figma.variables.getLocalVariableCollectionsAsync()).length : 0,
      };
    } catch (e) {
      figma.notify(`⚠️ Couldn't read existing variables: ${(e as { message?: string } | null)?.message ?? String(e)}`);
    }
    figma.ui.postMessage({ type: 'tokens-status', ...status });
  }
  if (msg.type === 'get-fonts') {
    try {
      const fonts = await figma.listAvailableFontsAsync();
      const fontNames = [...new Set(fonts.map((f: Font) => f.fontName.family))].sort();
      figma.ui.postMessage({ type: 'fonts-list', fonts: fontNames });
    } catch (_e) {
      figma.notify('⚠️ Couldn\'t load the font list — Inter will be used');
    }
  }
};
