import {
  RAMP_STOPS, STARTER_COLORS, TypeLevel, TS_RATIO,
  generateColorRamp, generateTypographyScale, generateSpacingScale, generateRadiusScale,
  generateBorderWidthScale, pickFontStyle, TYPE_LEVEL_NAMES, collectionKey,
  ELEVATION_LEVELS, OPACITY_STEPS, Z_INDEX_LAYERS, scopesFor, webCodeSyntax, ScopeLayer,
  analyzeRamp, brandColorNames, RampContrast, rgbToHex, hexToRgb, weightFromStyleName, FONT_WEIGHT_NAMES,
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

// Errors with wording written for the person using the plugin (bad input, nothing to convert, …)
// are UserErrors and are shown as they are. Anything else is an unexpected failure: its detail goes
// to the console for whoever is debugging, and the person sees a plain sentence instead.
class UserError extends Error {}

const GENERIC_FAILURE = 'Something unexpected went wrong.';

function userMessage(e: unknown, fallback = GENERIC_FAILURE): string {
  if (e instanceof UserError) return e.message;
  console.error('[Token System Generator Pro]', e);
  return fallback;
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
  nodes: [] as SceneNode[],   // canvas nodes (the foundation frame)
};

function stageCollection(name: string): VariableCollection {
  const collection = figma.variables.createVariableCollection(PENDING_PREFIX + name);
  staged.collections.push({ collection, finalName: name });
  return collection;
}

function stageNode<T extends SceneNode>(node: T): T {
  staged.nodes.push(node);
  return node;
}

function stageStyle<T extends BaseStyle>(style: T): T {
  staged.styles.push(style);
  return style;
}

// Returns how many staged items could not be removed.
function rollbackStaged(): number {
  let failed = 0;
  for (const node of staged.nodes) {
    try { node.remove(); } catch (_e) { failed++; }
  }
  for (const style of staged.styles) {
    try { style.remove(); } catch (_e) { failed++; }
  }
  for (const { collection } of staged.collections) {
    try { collection.remove(); } catch (_e) { failed++; }
  }
  staged.styles = [];
  staged.nodes = [];
  staged.collections = [];
  return failed;
}

interface ExistingTokens {
  collections: VariableCollection[];
  variables: Variable[];
  paintStyles: PaintStyle[];
  textStyles: TextStyle[];
  effectStyles: EffectStyle[];
  foundationFrames: FrameNode[];
}

// Replacing only touches what this plugin makes. Anything else in the file is left alone:
//  - collections named exactly like the ones it creates,
//  - paint styles named "<color>/<stop>" (e.g. cobalt/500),
//  - text styles named "<Display|Heading|Body copy>/<level>" (e.g. Heading/h1),
//  - effect styles named "Elevation/<level>" (e.g. Elevation/md).
const PLUGIN_COLLECTIONS: readonly string[] = ['01 Global', '02 Alias', '03 Component'];
const PAINT_STYLE_RE = new RegExp(`^[a-z][a-z0-9-]*/(${RAMP_STOPS.join('|')})$`);
const TEXT_STYLE_GROUPS: readonly string[] = ['Display', 'Heading', 'Body copy'];
const EFFECT_STYLE_RE = new RegExp(`^Elevation/(${ELEVATION_LEVELS.map(l => l.name).join('|')})$`);

const isPluginPaintStyle = (name: string): boolean => PAINT_STYLE_RE.test(name);
const isPluginTextStyle = (name: string): boolean => {
  const [group, level, ...rest] = name.split('/');
  return rest.length === 0 && TEXT_STYLE_GROUPS.includes(group) && (TYPE_LEVEL_NAMES as readonly string[]).includes(level);
};

const FOUNDATION_MARKER = 'tsg-foundation';
const isFoundationFrame = (n: SceneNode): n is FrameNode => n.type === 'FRAME' && n.getPluginData(FOUNDATION_MARKER) === '1';

async function snapshotExisting(mode: string, options: OutputOptions): Promise<ExistingTokens> {
  const collections = (await figma.variables.getLocalVariableCollectionsAsync()).filter(c => PLUGIN_COLLECTIONS.includes(c.name));
  const ids = new Set(collections.map(c => c.id));
  return {
    collections,
    variables: (await figma.variables.getLocalVariablesAsync()).filter(v => ids.has(v.variableCollectionId)),
    // Smart Convert reads the local styles, so they are kept.
    paintStyles: mode === 'convert' ? [] : (await figma.getLocalPaintStylesAsync()).filter(s => isPluginPaintStyle(s.name)),
    textStyles:  mode === 'convert' ? [] : (await figma.getLocalTextStylesAsync()).filter(s => isPluginTextStyle(s.name)),
    effectStyles: mode === 'convert' ? [] : (await figma.getLocalEffectStylesAsync()).filter(s => EFFECT_STYLE_RE.test(s.name)),
    // Drawing a new foundation replaces the one this plugin drew earlier on this page.
    foundationFrames: options.canvas ? figma.currentPage.findChildren(isFoundationFrame) as FrameNode[] : [],
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
  for (const style of old.effectStyles) {
    try { style.remove(); } catch (_e) { warn(`Couldn't remove an old effect style`); }
  }
  for (const frame of old.foundationFrames) {
    try { frame.remove(); } catch (_e) { warn(`Couldn't remove the previous foundation frame`); }
  }
  for (const { collection, finalName } of staged.collections) {
    try { collection.name = finalName; } catch (_e) { warn(`Couldn't rename "${finalName}"`); }
  }
  staged.collections = [];
  staged.styles = [];
  staged.nodes = [];
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
  throw new UserError(`No usable font found for "${requested}".`);
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
async function describeExisting(mode: string, options: OutputOptions): Promise<{
  collections: { name: string; variables: number }[];
  paintStyles: number;
  textStyles: number;
  effectStyles: number;
  foundationFrames: number;
}> {
  const old = await snapshotExisting(mode, options);
  return {
    collections: old.collections.map(c => ({
      name: c.name,
      variables: old.variables.filter(v => v.variableCollectionId === c.id).length,
    })),
    paintStyles: old.paintStyles.length,
    textStyles: old.textStyles.length,
    effectStyles: old.effectStyles.length,
    foundationFrames: old.foundationFrames.length,
  };
}

// ─── STARTER + SMART CONVERT ─────────────────────────────────────

type Tier = '2tier' | '3tier';

// Extra token scales From Scratch (and Starter) can add on top of colours, type, spacing and so on.
interface Extras {
  elevation: boolean; // shadow variables + Elevation/* effect styles
  opacity: boolean;   // opacity/0 … opacity/100
  zIndex: boolean;    // z-index/base … z-index/tooltip
}
const NO_EXTRAS: Extras = { elevation: false, opacity: false, zIndex: false };
const ALL_EXTRAS: Extras = { elevation: true, opacity: true, zIndex: true };

// Applies to every mode.
interface OutputOptions {
  scopes: boolean;      // set variable scopes and hide Global primitives that have an Alias counterpart
  codeSyntax: boolean;  // add a WEB code syntax (var(--…)) to every variable
  canvas: boolean;      // draw a labelled foundation frame (colour ramps, type, spacing …) on the current page
}

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
  extras: Extras;
}

async function createStarterSystem(tier: Tier): Promise<FoundationData> {
  return buildFromScratch({
    colors: STARTER_COLORS, spacingBase: 4, radiusBase: 4, widthBase: 1,
    fontBase: 16, ratioKey: 'major-third', tier, extras: ALL_EXTRAS,
  });
}

// Smart Convert reads the local paint/text styles and rebuilds them as variables.
// 3-tier adds a Component collection and names the alias colors `colors/…`;
// 2-tier names them `color/…`. Both names are kept so existing output doesn't change.
async function convertStylesToTokens(tier: Tier): Promise<FoundationData> {
  const colorStyles = await figma.getLocalPaintStylesAsync();
  const textStyles  = await figma.getLocalTextStylesAsync();
  if (colorStyles.length === 0 && textStyles.length === 0) {
    throw new UserError('No local styles found to convert.');
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
    throw new UserError('No solid color styles found to convert.');
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

  // Smart Convert has no ramps of its own, so the foundation shows the colour families it found.
  return {
    ramps: sortedFamilies.map(([family, vars]) => ({
      label: titleCase(family), name: family,
      stops: vars.map(v => ({ label: v.name.split('/').pop() ?? '', hex: variableHex(v, modeId), variable: v })),
    })),
  };
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

// Letter spacing in px, like every other size. The style is in px, so a bound variable must be too.
function letterSpacingPx(t: TypeLevel): number {
  return Math.round(t.fontSize * t.letterSpacing * 100) / 100;
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
  const brandNames = brandColorNames(colors as unknown as Record<string, string>, BRAND_KEYS);
  for (const key of BRAND_KEYS) {
    if (brandNames[key]) ramps[key] = createRampVariables(global, colors[key], brandNames[key]);
  }

  for (const key of SEMANTIC_KEYS) {
    const hex = colors[key];
    if (!hex || !HEX_RE.test(hex)) continue;
    ramps[key] = createRampVariables(global, hex, SEMANTIC_GLOBAL[key]);
  }

  return { ramps, brandNames };
}

function createSpacingVariables(global: VariableCollection, base: number): { name: string; value: number }[] {
  const made: { name: string; value: number }[] = [];
  for (const [k, v] of Object.entries(generateSpacingScale(base))) {
    createNumber(global, `spacing/${k}`, v);
    made.push({ name: k, value: v });
  }
  return made;
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
    letterSpacing[t.name]    = createNumber(global, `typography/letter-spacing/${t.name}`,    letterSpacingPx(t));
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
async function createTextStyles(typo: TypographyVars): Promise<Map<string, TextStyle>> {
  fontCatalog = null;
  const created: { made: CreatedTextStyle; level: string; role: 'heading' | 'body' }[] = [];
  for (const t of typo.levels) {
    const group = textStyleGroup(t.name);
    if (!group) continue;
    const role = group === 'Body copy' ? 'body' : 'heading';
    const made = await createLocalTextStyle({
      path: `${group}/${t.name}`, fontSize: t.fontSize, lineHeight: lineHeightPx(t),
      letterSpacing: letterSpacingPx(t), paragraphSpacing: t.paragraphSpacing,
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
  return new Map(created.map(c => [c.level, c.made.style]));
}

// Local paint styles mirroring each color ramp (brand names from the global step, semantic fixed).
interface ElevationVars {
  name: string;
  offsetY: Variable;
  blur: Variable;
  spread: Variable;
  color: Variable;
  rgba: RGBA;
}

// Shadow colour: the darkest Neutral stop when there is one, otherwise black.
function shadowRgb(ramps: Ramps, modeId: string): RGB {
  const value = ramps['neutral']?.[900]?.valuesByMode[modeId];
  return value && typeof value === 'object' && 'r' in value ? { r: value.r, g: value.g, b: value.b } : { r: 0, g: 0, b: 0 };
}

interface ExtraTokenData {
  elevation: ElevationVars[];
  opacity: { value: number; variable: Variable }[];
  zIndex: { name: string; value: number }[];
}

function createExtraTokens(global: VariableCollection, extras: Extras, ramps: Ramps): ExtraTokenData {
  const modeId = global.modes[0].modeId;
  const opacity: ExtraTokenData['opacity'] = [];
  const zIndex: ExtraTokenData['zIndex'] = [];
  if (extras.opacity) for (const n of OPACITY_STEPS) opacity.push({ value: n, variable: createNumber(global, `opacity/${n}`, n) });
  if (extras.zIndex) for (const [name, value] of Z_INDEX_LAYERS) { createNumber(global, `z-index/${name}`, value); zIndex.push({ name, value }); }

  const elevation: ElevationVars[] = [];
  if (extras.elevation) {
    const rgb = shadowRgb(ramps, modeId);
    for (const level of ELEVATION_LEVELS) {
      const rgba: RGBA = { ...rgb, a: level.alpha };
      const color = figma.variables.createVariable(`elevation/${level.name}/color`, global, 'COLOR');
      color.setValueForMode(modeId, rgba);
      elevation.push({
        name: level.name, rgba, color,
        offsetY: createNumber(global, `elevation/${level.name}/offset-y`, level.offsetY),
        blur:    createNumber(global, `elevation/${level.name}/blur`,     level.blur),
        spread:  createNumber(global, `elevation/${level.name}/spread`,   level.spread),
      });
    }
  }
  return { elevation, opacity, zIndex };
}

// One Elevation/<level> effect style per level, its shadow bound to that level's variables.
function createElevationStyles(levels: ElevationVars[]): { name: string; style: EffectStyle }[] {
  const made: { name: string; style: EffectStyle }[] = [];
  for (const v of levels) {
    const style = stageStyle(figma.createEffectStyle());
    style.name = `Elevation/${v.name}`;
    const level = ELEVATION_LEVELS.find(l => l.name === v.name) as typeof ELEVATION_LEVELS[number];
    let effect: Effect = {
      type: 'DROP_SHADOW', color: v.rgba, offset: { x: 0, y: level.offsetY },
      radius: level.blur, spread: level.spread, visible: true, blendMode: 'NORMAL',
    };
    try {
      effect = figma.variables.setBoundVariableForEffect(effect, 'color', v.color);
      effect = figma.variables.setBoundVariableForEffect(effect, 'offsetY', v.offsetY);
      effect = figma.variables.setBoundVariableForEffect(effect, 'radius', v.blur);
      effect = figma.variables.setBoundVariableForEffect(effect, 'spread', v.spread);
    } catch (_e) {
      warn(`Couldn't link an elevation style to its variables`);
    }
    style.effects = [effect];
    made.push({ name: v.name, style });
  }
  return made;
}

// Scopes decide which Figma pickers list a variable; code syntax is the name shown in Dev Mode.
// Neither is essential, so a variable that refuses them becomes a warning instead of failing the run.
async function applyVariableMetadata(options: OutputOptions): Promise<void> {
  if (!options.scopes && !options.codeSyntax) return;
  const layerByCollection = new Map(staged.collections.map(c => [c.collection.id, collectionKey(c.finalName)]));
  let failed = 0;
  for (const v of await figma.variables.getLocalVariablesAsync()) {
    const layer = layerByCollection.get(v.variableCollectionId);
    if (!layer) continue;
    try {
      if (options.scopes) {
        const scopes = scopesFor(layer as ScopeLayer, v.name, v.resolvedType);
        if (scopes) v.scopes = scopes as VariableScope[];
      }
      if (options.codeSyntax) v.setVariableCodeSyntax('WEB', webCodeSyntax(layer, v.name));
    } catch (_e) {
      failed++;
    }
  }
  if (failed) warn(`Couldn't set scopes or code syntax on ${failed} variable${failed > 1 ? 's' : ''}`);
}

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

  // One surface per brand color, mapped to its 500 stop. Tertiary is optional on the From Scratch
  // screen, so each surface exists whenever its own color does rather than only when all four do.
  for (const role of BRAND_KEYS) {
    const ramp = colorAliases[role];
    if (ramp) alias(comp, `surface/${role}`, ramp[500]);
  }

  if (primary) {
    alias(comp, 'border/default',  primary[500]);
    alias(comp, 'border/subtle',   primary[300]);
    alias(comp, 'border/disabled', primary[100]);
    alias(comp, 'border/inverse',  primary[900]);
  }
}

// Everything the canvas foundation draws, handed over by whichever mode just built the tokens.
interface FoundationData {
  ramps: { label: string; name: string; stops: { label: string; hex: string; variable: Variable }[] }[];
  spacing?: { name: string; value: number }[];
  radius?: ScaleVars;
  width?: ScaleVars;
  typography?: { levels: TypeLevel[]; styles: Map<string, TextStyle> };
  elevation?: { name: string; style: EffectStyle }[];
  opacity?: { value: number; variable: Variable }[];
  zIndex?: { name: string; value: number }[];
}

const titleCase = (s: string): string => s[0].toUpperCase() + s.slice(1);

function variableHex(v: Variable, modeId: string): string {
  const c = v.valuesByMode[modeId];
  return c && typeof c === 'object' && 'r' in c ? rgbToHex(c.r, c.g, c.b).toUpperCase() : '';
}

async function buildFromScratch(o: ScratchOptions): Promise<FoundationData> {
  // 01 Global
  const global = stageCollection('01 Global');
  const { ramps, brandNames } = createGlobalColors(global, o.colors);
  const spacing = createSpacingVariables(global, o.spacingBase);
  const radius = createScaleGlobals(global, 'borderRadius', generateRadiusScale(o.radiusBase));
  const width  = createScaleGlobals(global, 'borderWidth', generateBorderWidthScale(o.widthBase));
  const typo   = createTypographyVariables(global, o.fontBase, o.ratioKey, o.fontFamily || 'Inter', o.bodyFontFamily);
  const extra = createExtraTokens(global, o.extras, ramps);

  // 02 Alias, then the local styles that mirror the tokens
  const { colorAliases } = createAliasCollection(ramps, radius, width, typo);
  const textStyles = await createTextStyles(typo);
  createPaintStyles(global, ramps, brandNames);
  const elevationStyles = createElevationStyles(extra.elevation);

  // 03 Component
  if (o.tier === '3tier') createComponentCollection(colorAliases);

  const modeId = global.modes[0].modeId;
  return {
    ramps: [...BRAND_KEYS, ...SEMANTIC_KEYS].filter(key => ramps[key]).map(key => ({
      label: titleCase(key),
      name: (BRAND_KEYS as readonly string[]).includes(key) ? brandNames[key] : SEMANTIC_GLOBAL[key as typeof SEMANTIC_KEYS[number]],
      stops: RAMP_STOPS.map(stop => ({ label: String(stop), hex: variableHex(ramps[key][stop], modeId), variable: ramps[key][stop] })),
    })),
    spacing, radius, width,
    typography: { levels: typo.levels, styles: textStyles },
    elevation: elevationStyles.length ? elevationStyles : undefined,
    opacity: extra.opacity.length ? extra.opacity : undefined,
    zIndex: extra.zIndex.length ? extra.zIndex : undefined,
  };
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
const TOKEN_TYPES: Record<string, string> = { COLOR: 'color', FLOAT: 'number', STRING: 'fontFamily', BOOLEAN: 'boolean' };

async function exportVariablesToJSON(): Promise<string> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const allVars = await figma.variables.getLocalVariablesAsync();
  const result = newNode();
  const toCamelCase = (str: string) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
  // 8 digits (#RRGGBBAA) when the colour is partly transparent, as for shadow colours.
  const colorToHex = (c: { r: number; g: number; b: number; a?: number }) => {
    const h = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
    const alpha = c.a !== undefined && c.a < 1 ? h(c.a) : '';
    return `#${h(c.r)}${h(c.g)}${h(c.b)}${alpha}`.toUpperCase();
  };

  const collectionById = new Map<string, VariableCollection>();
  const collectionNames = new Map<string, string>();
  const usedKeys = new Set<string>();
  collections.forEach(col => {
    collectionById.set(col.id, col);
    // Two collections can reduce to the same key ("Global" and "01 Global"), so keys are made unique.
    let key = collectionKey(col.name);
    for (let n = 2; usedKeys.has(key); n++) key = `${collectionKey(col.name)}${n}`;
    usedKeys.add(key);
    collectionNames.set(col.id, key);
  });

  // Lookup for resolving aliases: varId -> "collection.path.to.token"
  const varTokens = new Map<string, string>();
  allVars.forEach(v => {
    const colName = collectionNames.get(v.variableCollectionId) || 'unknown';
    varTokens.set(v.id, `${colName}.${v.name.split('/').map(p => toCamelCase(p)).join('.')}`);
  });

  collections.forEach(col => {
    const colName = collectionNames.get(col.id) as string;
    const colResult = childNode(result, colName);
    const mode = col.modes[0];

    allVars.filter(v => v.variableCollectionId === col.id).forEach(v => {
      const val = v.valuesByMode[mode.modeId];
      const parts = v.name.split('/');
      let current = colResult;
      for (let i = 0; i < parts.length - 1; i++) current = childNode(current, toCamelCase(parts[i]));

      // Numbers in this plugin's own collections are pixel sizes, except font weights. They are exported
      // as "16px" strings so tools like Style Dictionary know the unit instead of guessing (a bare 16
      // would become 16rem). Numbers in other collections are left as plain numbers.
      const isWeight = /(^|\/)(font-weight|fontWeight)(\/|$)/.test(v.name);
      // Unitless scales: opacity is stored 0–100 for Figma and exported as 0–1 for CSS; z-index is a plain number.
      const isOpacity = v.resolvedType === 'FLOAT' && /^opacity\//.test(v.name) && PLUGIN_COLLECTIONS.includes(col.name);
      const isZIndex = v.resolvedType === 'FLOAT' && /^z-index\//.test(v.name) && PLUGIN_COLLECTIONS.includes(col.name);
      const isPixelSize = v.resolvedType === 'FLOAT' && !isWeight && !isOpacity && !isZIndex && PLUGIN_COLLECTIONS.includes(col.name);
      const type = isWeight ? 'fontWeight' : isPixelSize ? 'dimension' : (TOKEN_TYPES[v.resolvedType] ?? 'unknown');
      let value: unknown = val;
      if (isOpacity && typeof val === 'number') {
        value = val / 100;
      } else if (isPixelSize && typeof val === 'number') {
        value = `${val}px`;
      } else if (v.resolvedType === 'COLOR' && val && typeof val === 'object' && 'r' in val) {
        value = colorToHex(val as { r: number; g: number; b: number; a?: number });
      } else if (val && typeof val === 'object' && (val as { type?: string }).type === 'VARIABLE_ALIAS') {
        const token = varTokens.get((val as { id: string }).id);
        if (token) value = `{${token}}`;
      }
      current[toCamelCase(parts[parts.length - 1])] = { value, type };
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
    const err = e as { leftover?: number } | null;
    const message = e instanceof GenerationError ? e.message : userMessage(e);
    const leftover = err?.leftover ?? 0;
    figma.notify(`❌ Generation failed. ${message}`, { error: true });
    figma.ui.postMessage({ type: 'generation-failed', message, leftover });
  }
}

async function runGeneration(r: GenerateRequest): Promise<void> {
  const blocked = await blockedReason(r.mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  // Only ask when something this plugin made would actually be replaced.
  const existing = await describeExisting(r.mode, r.options);
  if (existing.collections.length > 0 || existing.paintStyles > 0 || existing.textStyles > 0 || existing.effectStyles > 0 || existing.foundationFrames > 0) {
    figma.ui.postMessage({ type: 'confirm-replace', existing }); return;
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
    fontFamily: r.fontFamily, bodyFontFamily: r.bodyFontFamily, extras: r.extras,
  };
}

// Build everything under staging names first; replace the old tokens only if the whole build worked.
// If it throws, everything staged is removed and the file is left exactly as it was.
async function generate(r: GenerateRequest): Promise<void> {
  const blocked = await blockedReason(r.mode);
  if (blocked) { figma.ui.postMessage({ type: 'generation-blocked', reason: blocked }); return; }
  issues.clear();
  fontCatalog = null;
  const old = await snapshotExisting(r.mode, r.options);
  const tier = r.approach;

  try {
    let data: FoundationData | undefined;
    if (r.mode === 'scratch') data = await buildFromScratch(scratchOptions(r));
    else if (r.mode === 'starter') data = await createStarterSystem(tier);
    else if (r.mode === 'convert') data = await convertStylesToTokens(tier);
    await applyVariableMetadata(r.options);
    if (r.options.canvas && data) await drawFoundationSafely(data, old.foundationFrames[0]);
  } catch (e) {
    const leftover = rollbackStaged();
    throw new GenerationError(userMessage(e), leftover);
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

// ─── CANVAS FOUNDATION ───────────────────────────────────────────
// An optional, labelled frame on the current page that shows the tokens just generated: colour ramps
// (fills bound to the variables), the type scale (real text styles), spacing, radius, border width,
// elevation, opacity and z-index. Regenerating with the option on replaces the previous frame.

const INK: RGB = { r: 0.09, g: 0.09, b: 0.11 };
const MUTED: RGB = { r: 0.42, g: 0.43, b: 0.47 };
const PAPER: RGB = { r: 1, g: 1, b: 1 };
const WELL: RGB = { r: 0.95, g: 0.96, b: 0.97 };
const solid = (color: RGB, opacity = 1): SolidPaint => ({ type: 'SOLID', color, opacity });

function frameOf(parent: FrameNode | null, name: string, dir: 'HORIZONTAL' | 'VERTICAL', gap: number): FrameNode {
  const f = figma.createFrame();
  f.name = name;
  f.layoutMode = dir;
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  f.itemSpacing = gap;
  f.fills = [];
  if (parent) parent.appendChild(f);
  return f;
}

// A column of fixed width that grows downward, so labels line up across rows.
function columnOf(parent: FrameNode, width: number, gap: number): FrameNode {
  const f = frameOf(parent, 'Label', 'VERTICAL', gap);
  f.resize(width, 10);
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'FIXED';
  return f;
}

function textOf(parent: FrameNode, chars: string, size: number, font: FontName, color: RGB): TextNode {
  const t = figma.createText();
  parent.appendChild(t);
  t.fontName = font;
  t.fontSize = size;
  t.characters = chars;
  t.fills = [solid(color)];
  return t;
}

function rectOf(parent: FrameNode, w: number, h: number, radius: number): RectangleNode {
  const r = figma.createRectangle();
  parent.appendChild(r);
  r.resize(w, h);
  r.cornerRadius = radius;
  return r;
}

const sampleText = (level: string): string =>
  level.startsWith('display') ? 'Display' : /^h[1-6]$/.test(level) ? 'Heading text' : 'The quick brown fox jumps over the lazy dog';

// Beside the existing work on the page (or centred on an empty page); in place of the previous
// foundation when there is one.
function placeFoundation(root: FrameNode, previous: FrameNode | undefined): void {
  if (previous) { root.x = previous.x; root.y = previous.y; return; }
  const others = figma.currentPage.children.filter(n => n !== root);
  if (others.length === 0) {
    const c = figma.viewport.center;
    root.x = Math.round(c.x - root.width / 2);
    root.y = Math.round(c.y - Math.min(root.height, 800) / 2);
    return;
  }
  root.x = Math.max(...others.map(n => n.x + n.width)) + 200;
  root.y = Math.min(...others.map(n => n.y));
}

async function drawFoundation(data: FoundationData, previous: FrameNode | undefined): Promise<void> {
  const regular = (await resolveTextFont('Inter', 400)).font;
  const strong = (await resolveTextFont('Inter', 600)).font;

  const root = stageNode(figma.createFrame());
  root.name = 'Token System Foundation';
  root.setPluginData(FOUNDATION_MARKER, '1');
  root.layoutMode = 'VERTICAL';
  root.primaryAxisSizingMode = 'AUTO';
  root.counterAxisSizingMode = 'AUTO';
  root.paddingLeft = root.paddingRight = root.paddingTop = root.paddingBottom = 64;
  root.itemSpacing = 72;
  root.cornerRadius = 24;
  root.fills = [solid(PAPER)];

  const head = frameOf(root, 'Header', 'VERTICAL', 8);
  textOf(head, 'Token System', 44, strong, INK);
  textOf(head, 'Foundation generated by Token System Generator Pro', 16, regular, MUTED);

  const section = (title: string): FrameNode => {
    const s = frameOf(root, title, 'VERTICAL', 28);
    textOf(s, title, 28, strong, INK);
    return s;
  };
  const caption = (parent: FrameNode, name: string, detail: string): void => {
    textOf(parent, name, 13, strong, INK);
    textOf(parent, detail, 12, regular, MUTED);
  };

  // Colour ramps
  const colors = section('Color ramps');
  for (const ramp of data.ramps) {
    const row = frameOf(colors, ramp.label, 'HORIZONTAL', 12);
    const label = columnOf(row, 150, 4);
    textOf(label, ramp.label, 16, strong, INK);
    textOf(label, ramp.name, 13, regular, MUTED);
    for (const stop of ramp.stops) {
      const cell = frameOf(row, stop.label, 'VERTICAL', 6);
      const swatch = rectOf(cell, 96, 64, 8);
      swatch.fills = [figma.variables.setBoundVariableForPaint(solid(hexToRgb(stop.hex)), 'color', stop.variable)];
      swatch.strokes = [solid(INK, 0.1)];
      swatch.strokeWeight = 1;
      swatch.strokeAlign = 'INSIDE';
      textOf(cell, stop.label, 13, strong, INK);
      textOf(cell, stop.hex, 12, regular, MUTED);
    }
  }

  // Type scale: each sample uses the real text style
  if (data.typography) {
    const type = section('Type scale');
    for (const level of data.typography.levels) {
      const style = data.typography.styles.get(level.name);
      if (!style) continue;
      const row = frameOf(type, level.name, 'HORIZONTAL', 32);
      row.counterAxisAlignItems = 'CENTER';
      const meta = columnOf(row, 260, 2);
      textOf(meta, level.name, 14, strong, INK);
      textOf(meta, `${level.fontSize}px · weight ${level.fontWeight}`, 12, regular, MUTED);
      const sample = figma.createText();
      row.appendChild(sample);
      sample.characters = sampleText(level.name);
      await sample.setTextStyleIdAsync(style.id);
      sample.fills = [solid(INK)];
    }
  }

  // Spacing
  if (data.spacing) {
    const spacing = section('Spacing');
    for (const step of data.spacing) {
      const row = frameOf(spacing, `spacing/${step.name}`, 'HORIZONTAL', 16);
      row.counterAxisAlignItems = 'CENTER';
      textOf(columnOf(row, 120, 0), `${step.value}px`, 13, strong, INK);
      const bar = rectOf(row, step.value, 16, 3);
      bar.fills = [solid(INK, 0.85)];
    }
  }

  // Radius + border width
  if (data.radius || data.width) {
    const shape = section('Radius and border width');
    if (data.radius) {
      const row = frameOf(shape, 'Radius', 'HORIZONTAL', 28);
      for (const [name, value] of data.radius.entries) {
        const cell = frameOf(row, `radius/${name}`, 'VERTICAL', 10);
        const box = rectOf(cell, 72, 72, Math.min(value, 36));
        box.fills = [solid(WELL)];
        box.strokes = [solid(INK, 0.2)];
        box.strokeWeight = 1;
        const variable = data.radius.byValue.get(value);
        if (variable) for (const corner of ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'] as const) box.setBoundVariable(corner, variable);
        caption(cell, name, `${value}px`);
      }
    }
    if (data.width) {
      const row = frameOf(shape, 'Border width', 'HORIZONTAL', 28);
      for (const [name, value] of data.width.entries) {
        const cell = frameOf(row, `border/${name}`, 'VERTICAL', 10);
        const box = rectOf(cell, 72, 72, 8);
        box.fills = [solid(PAPER)];
        if (value > 0) {
          box.strokes = [solid(INK)];
          box.strokeWeight = value;
          box.strokeAlign = 'INSIDE';
          const variable = data.width.byValue.get(value);
          if (variable) box.setBoundVariable('strokeWeight', variable);
        } else {
          box.strokes = [solid(INK, 0.15)];
          box.strokeWeight = 1;
        }
        caption(cell, name, `${value}px`);
      }
    }
  }

  // Elevation: white cards on a light well, each with its effect style
  if (data.elevation) {
    const elevation = section('Elevation');
    const well = frameOf(elevation, 'Elevation levels', 'HORIZONTAL', 40);
    well.paddingLeft = well.paddingRight = well.paddingTop = well.paddingBottom = 40;
    well.cornerRadius = 16;
    well.fills = [solid(WELL)];
    for (const level of data.elevation) {
      const cell = frameOf(well, `elevation/${level.name}`, 'VERTICAL', 14);
      const card = rectOf(cell, 96, 96, 12);
      card.fills = [solid(PAPER)];
      await card.setEffectStyleIdAsync(level.style.id);
      caption(cell, level.name, level.style.name);
    }
  }

  // Opacity
  if (data.opacity) {
    const opacity = section('Opacity');
    const well = frameOf(opacity, 'Opacity steps', 'HORIZONTAL', 28);
    well.paddingLeft = well.paddingRight = well.paddingTop = well.paddingBottom = 32;
    well.cornerRadius = 16;
    well.fills = [solid(WELL)];
    for (const step of data.opacity) {
      const cell = frameOf(well, `opacity/${step.value}`, 'VERTICAL', 10);
      const chip = rectOf(cell, 72, 72, 10);
      chip.fills = [solid(INK)];
      chip.setBoundVariable('opacity', step.variable);
      caption(cell, `${step.value}%`, `opacity/${step.value}`);
    }
  }

  // Z-index
  if (data.zIndex) {
    const layers = section('Z-index');
    for (const layer of data.zIndex) {
      const row = frameOf(layers, `z-index/${layer.name}`, 'HORIZONTAL', 16);
      textOf(columnOf(row, 160, 0), layer.name, 14, strong, INK);
      textOf(row, String(layer.value), 14, regular, MUTED);
    }
  }

  placeFoundation(root, previous);
  figma.viewport.scrollAndZoomIntoView([root]);
}

// The foundation is decoration, so a drawing problem must not fail the tokens: take back whatever
// was drawn and carry on with a warning.
async function drawFoundationSafely(data: FoundationData, previous: FrameNode | undefined): Promise<void> {
  const before = staged.nodes.length;
  try {
    await drawFoundation(data, previous);
  } catch (e) {
    for (const node of staged.nodes.splice(before)) {
      try { node.remove(); } catch (_e) { warn(`Couldn't remove a partly drawn foundation frame`); }
    }
    console.error('[Token System Generator Pro]', e);
    warn("Couldn't draw the foundation on the canvas.");
  }
}

// ─── CONTRAST + PREVIEW ──────────────────────────────────────────

interface RampReport {
  key: string;        // primary, secondary, … info, success, …
  label: string;      // "Primary", "Info"
  name: string;       // the colour's name ("cobalt")
  contrast: RampContrast;
}

// The ramps From Scratch would generate for the colours typed so far, with their contrast.
// Anything that isn't a valid hex yet is skipped, so this is safe to call on every keystroke.
function previewRamps(raw: unknown): RampReport[] {
  if (!raw || typeof raw !== 'object') return [];
  const input = raw as Record<string, unknown>;
  const colors: Record<string, string> = {};
  for (const key of [...BRAND_KEYS, ...SEMANTIC_KEYS]) {
    const hex = input[key];
    if (typeof hex === 'string' && HEX_RE.test(hex)) colors[key] = hex;
  }
  const brandNames = brandColorNames(colors, BRAND_KEYS);
  const reports: RampReport[] = [];
  for (const key of [...BRAND_KEYS, ...SEMANTIC_KEYS]) {
    if (!colors[key]) continue;
    const name = (BRAND_KEYS as readonly string[]).includes(key) ? brandNames[key] : SEMANTIC_GLOBAL[key as typeof SEMANTIC_KEYS[number]];
    reports.push({ key, label: titleCase(key), name, contrast: analyzeRamp(generateColorRamp(colors[key])) });
  }
  return reports;
}

const ALIAS_COLOR_RE = /^colors?\/(?:(primary|secondary|tertiary|accent)|feedback\/(info|success|error|warning|neutral))\/(\d+)$/;

// The colour ramps in this file's Alias collection, with their contrast. Each Alias colour is
// followed to the Global colour it points at.
async function readFileRamps(): Promise<RampReport[]> {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const alias = collections.find(c => c.name === '02 Alias');
  if (!alias) return [];
  const variables = await figma.variables.getLocalVariablesAsync();
  const byId = new Map(variables.map(v => [v.id, v]));

  const resolve = (v: Variable | undefined): { rgb: RGB; source: string } | null => {
    let current = v;
    for (let hops = 0; current && hops < 6; hops++) {
      const collection = collections.find(c => c.id === current!.variableCollectionId);
      const value = collection ? current.valuesByMode[collection.modes[0].modeId] : undefined;
      if (value && typeof value === 'object' && 'r' in value) return { rgb: { r: value.r, g: value.g, b: value.b }, source: current.name };
      if (value && typeof value === 'object' && 'id' in value) { current = byId.get(value.id); continue; }
      break;
    }
    return null;
  };

  const groups = new Map<string, { label: string; ramp: Record<number, RGB>; name: string }>();
  for (const v of variables) {
    if (v.variableCollectionId !== alias.id) continue;
    const m = ALIAS_COLOR_RE.exec(v.name);
    if (!m) continue;
    const resolved = resolve(v);
    if (!resolved) continue;
    const key = m[1] ?? m[2];
    if (!groups.has(key)) groups.set(key, { label: titleCase(key), ramp: {}, name: resolved.source.split('/')[1] ?? key });
    groups.get(key)!.ramp[Number(m[3])] = resolved.rgb;
  }

  const order = [...BRAND_KEYS, ...SEMANTIC_KEYS] as readonly string[];
  return Array.from(groups.entries())
    .filter(([, g]) => Object.keys(g.ramp).length >= 2)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([key, g]) => ({ key, label: g.label, name: g.name, contrast: analyzeRamp(g.ramp) }));
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
  extras: Extras;
  options: OutputOptions;
}

// What the panel sends; checked field by field in parseRequest.
interface UiMessage extends Partial<Omit<GenerateRequest, 'extras' | 'options'>> {
  type: string;
  extras?: unknown;
  options?: unknown;
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
    throw new UserError(`${label} must be a whole number from ${min} to ${max}.`);
  }
  return value;
}

// A settings object of true/false flags: missing flags take their default, anything else is rejected.
function parseFlags<T extends object>(raw: unknown, defaults: T, label: string): T {
  if (raw === undefined) return { ...defaults };
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new UserError(`Invalid ${label}.`);
  const out = { ...defaults } as Record<string, boolean>;
  for (const key of Object.keys(defaults)) {
    const value = (raw as Record<string, unknown>)[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') throw new UserError(`Invalid ${label}.${key}.`);
    out[key] = value;
  }
  return out as unknown as T;
}

// The UI is trusted to be ours, but it is the only input to everything that follows, so check it.
function parseRequest(msg: UiMessage): GenerateRequest {
  if (msg.approach !== '2tier' && msg.approach !== '3tier') throw new UserError('Unknown architecture.');
  if (msg.mode !== 'scratch' && msg.mode !== 'starter' && msg.mode !== 'convert') throw new UserError('Unknown mode.');
  const request: GenerateRequest = {
    approach: msg.approach, mode: msg.mode,
    extras: msg.mode === 'starter' ? ALL_EXTRAS : NO_EXTRAS,
    options: parseFlags(msg.options, { scopes: true, codeSyntax: true, canvas: false }, 'options'),
  };
  if (msg.mode !== 'scratch') return request;

  const raw = msg.colors as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== 'object') throw new UserError('Brand colors are missing.');
  const colors = {} as Record<string, string>;
  for (const key of [...BRAND_KEYS, ...SEMANTIC_KEYS]) {
    const hex = raw[key];
    const required = key === 'primary' || key === 'secondary' || key === 'accent';
    if (typeof hex === 'string' && HEX_RE.test(hex)) colors[key] = hex;
    else if (!required && (hex === undefined || hex === '' || hex === '#')) colors[key] = '';
    else throw new UserError(`${key[0].toUpperCase()}${key.slice(1)} must be a 6-digit hex color like #3D6BE8.`);
  }
  if (typeof msg.ratioKey !== 'string' || !Object.prototype.hasOwnProperty.call(TS_RATIO, msg.ratioKey)) {
    throw new UserError('Unknown type scale ratio.');
  }
  if (typeof msg.fontFamily !== 'string' || !msg.fontFamily || msg.fontFamily.length > 200) {
    throw new UserError('Choose a font family.');
  }
  // Optional: blank or missing means one font for everything.
  const body = msg.bodyFontFamily;
  if (body !== undefined && body !== '' && (typeof body !== 'string' || body.length > 200)) {
    throw new UserError('Body font is not valid.');
  }
  return {
    ...request,
    extras: parseFlags(msg.extras, NO_EXTRAS, 'extras'),
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
      figma.notify(`❌ ${userMessage(e, "Couldn't export your variables. Please try again.")}`, { error: true });
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
      console.error('[Token System Generator Pro]', e);
      figma.notify("⚠️ Couldn't read the existing variables.");
    }
    figma.ui.postMessage({ type: 'tokens-status', ...status });
  }
  if (msg.type === 'preview-ramps') {
    figma.ui.postMessage({ type: 'ramp-preview', ramps: previewRamps(msg.colors as unknown) });
  }
  if (msg.type === 'check-contrast') {
    try {
      figma.ui.postMessage({ type: 'contrast-data', ramps: await readFileRamps() });
    } catch (e) {
      figma.ui.postMessage({ type: 'contrast-data', ramps: [], error: userMessage(e, "Couldn't read your color variables. Please try again.") });
    }
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
