/**
 * Reads a Figma node into the Layer shape of components.json (designmd.components/v1).
 *
 * Everything here is duck-typed on plain property access, with each read guarded, so it works
 * on live Figma nodes and on plain objects in tests. Nothing in the result is a Figma symbol:
 * `figma.mixed` never leaks out. Roles are not assigned here (see transform/roles.ts).
 */
import type {
  ColorRgba,
  ComponentsWarning,
  CornerRadii,
  Layer,
  LayerEffect,
  LayerLayout,
  LayerPaint,
  LayerStrokes,
  LayerText,
  PropertyRefs,
  TextRun,
  TextStyleFields,
  TokenRef,
  UnitValue,
} from '@shared/componentsSchema';

/** Same budget as the token-usage scan, so a component costs the same everywhere. */
export const MAX_LAYERS = 500;
export const MAX_DEPTH = 10;

type Node = Record<string, unknown>;

export interface ReadLayerOptions {
  /** Include text characters. Default true. */
  includeText?: boolean;
  /** Layer budget for the whole tree. Default MAX_LAYERS. */
  maxLayers?: number;
  /** Depth budget. Default MAX_DEPTH. */
  maxDepth?: number;
  /** Looks up the CSS name of a variable or style. Without it, no `token` is written. */
  resolveToken?: (kind: 'variable' | 'style', id: string) => string | undefined;
  /**
   * Read the layers inside nested instances (default true). Off, an instance is listed with the
   * component it points at but its insides are not read: far fewer calls and a smaller file.
   */
  includeInstanceInternals?: boolean;
  /** Checked before each layer; when it returns true the tree is cut short and flagged truncated. */
  shouldStop?: () => boolean;
  /** Awaited before each layer; lets the caller hand control back to Figma now and then. */
  yieldIfDue?: () => Promise<void>;
  /** Filled in as layers are read, so a slow run can be explained with numbers. */
  stats?: ReadStats;
}

/** Counters for one run. Times are wall-clock milliseconds. */
export interface ReadStats {
  layers: number;
  trees: number;
  instanceLookups: number;
  instanceMs: number;
}

export const newReadStats = (): ReadStats => ({
  layers: 0,
  trees: 0,
  instanceLookups: 0,
  instanceMs: 0,
});

export interface ReadLayerResult {
  tree: Layer;
  /** True when the layer or depth budget was hit, so the tree is incomplete. */
  truncated: boolean;
  /** Variable ids written as tokens in the tree. */
  usedVariableIds: string[];
  /** Style ids written as tokens in the tree. */
  usedStyleIds: string[];
  warnings: ComponentsWarning[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

function read(n: unknown, key: string): unknown {
  try {
    return (n as Node)[key];
  } catch {
    return undefined;
  }
}
/** A finite number, or undefined for anything else, including figma.mixed (a symbol). */
function num(n: unknown, key: string): number | undefined {
  const v = read(n, key);
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}
function str(n: unknown, key: string): string | undefined {
  const v = read(n, key);
  return typeof v === 'string' ? v : undefined;
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

const hex2 = (c: number) =>
  Math.max(0, Math.min(255, Math.round(c * 255)))
    .toString(16)
    .padStart(2, '0');
function hexOf(color: unknown): string | undefined {
  const r = num(color, 'r');
  const g = num(color, 'g');
  const b = num(color, 'b');
  return r === undefined || g === undefined || b === undefined
    ? undefined
    : `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}
function rgba(color: unknown, alphaOverride?: number): ColorRgba | undefined {
  const hex = hexOf(color);
  if (!hex) return undefined;
  const to255 = (k: string) => Math.round((num(color, k) ?? 0) * 255);
  return {
    hex,
    alpha: round3(alphaOverride ?? num(color, 'a') ?? 1),
    r: to255('r'),
    g: to255('g'),
    b: to255('b'),
  };
}

class Tracker {
  variables = new Set<string>();
  styles = new Set<string>();
  warnings: ComponentsWarning[] = [];
  private unresolved = new Set<string>();
  constructor(private resolve: ReadLayerOptions['resolveToken']) {}

  /** Whether token references are being looked up at all. */
  get resolves(): boolean {
    return !!this.resolve;
  }

  token(kind: 'variable' | 'style', id: string | undefined, layerId: string): TokenRef | undefined {
    if (!id || !this.resolve) return undefined;
    const cssName = this.resolve(kind, id);
    if (cssName === undefined) {
      // The resolved value is already on the layer, so dropping the reference loses nothing.
      if (!this.unresolved.has(id)) {
        this.unresolved.add(id);
        this.warnings.push({
          code: 'UNRESOLVED_REFERENCE',
          message: `The ${kind} ${id} is used by a layer but is not available (hidden from publishing or from another file), so its resolved value is used instead.`,
          layerId,
        });
      }
      return undefined;
    }
    (kind === 'variable' ? this.variables : this.styles).add(id);
    return kind === 'variable' ? { variableId: id, cssName } : { styleId: id, cssName };
  }
}

function boundVariableId(holder: unknown, field: string): string | undefined {
  const bound = read(holder, 'boundVariables');
  const alias = bound && typeof bound === 'object' ? (bound as Node)[field] : undefined;
  const id = alias && typeof alias === 'object' ? (alias as Node).id : undefined;
  return typeof id === 'string' ? id : undefined;
}

function readPaints(
  paints: unknown,
  styleId: string | undefined,
  layerId: string,
  t: Tracker,
): LayerPaint[] | undefined {
  if (!Array.isArray(paints)) return undefined; // missing, or figma.mixed
  return paints.map((p): LayerPaint => {
    const type = oneOf(
      read(p, 'type'),
      [
        'SOLID',
        'GRADIENT_LINEAR',
        'GRADIENT_RADIAL',
        'GRADIENT_ANGULAR',
        'GRADIENT_DIAMOND',
        'IMAGE',
        'VIDEO',
        'PATTERN',
      ] as const,
      'SOLID',
    );
    const paint: LayerPaint = { type, visible: read(p, 'visible') !== false };
    if (type === 'SOLID') {
      const hex = hexOf(read(p, 'color'));
      if (hex) paint.hex = hex;
      paint.alpha = round3(num(p, 'opacity') ?? 1);
    } else if (type.startsWith('GRADIENT')) {
      const stops = read(p, 'gradientStops');
      const count = Array.isArray(stops) ? stops.length : 0;
      paint.description = `${type.slice(9).toLowerCase()} gradient, ${count} stops`;
    } else if (type === 'IMAGE') {
      paint.description = `image, scale mode ${str(p, 'scaleMode') ?? 'unknown'}`;
    }
    const token =
      t.token('variable', boundVariableId(p, 'color'), layerId) ??
      t.token('style', styleId, layerId);
    if (token) paint.token = token;
    return paint;
  });
}

function readEffects(
  effects: unknown,
  styleId: string | undefined,
  layerId: string,
  t: Tracker,
): LayerEffect[] | undefined {
  if (!Array.isArray(effects)) return undefined;
  const styleToken = t.token('style', styleId, layerId);
  return effects.map((e): LayerEffect => {
    const type = oneOf(
      read(e, 'type'),
      ['DROP_SHADOW', 'INNER_SHADOW', 'LAYER_BLUR', 'BACKGROUND_BLUR'] as const,
      'DROP_SHADOW',
    );
    const effect: LayerEffect = {
      type,
      visible: read(e, 'visible') !== false,
      radius: round2(num(e, 'radius') ?? 0),
    };
    const color = rgba(read(e, 'color'));
    if (color) effect.color = color;
    const offset = read(e, 'offset');
    if (offset && typeof offset === 'object') {
      effect.offsetX = round2(num(offset, 'x') ?? 0);
      effect.offsetY = round2(num(offset, 'y') ?? 0);
    }
    if (num(e, 'spread') !== undefined) effect.spread = round2(num(e, 'spread')!);
    if (styleToken) effect.token = styleToken;
    return effect;
  });
}

/** True for a non-empty list. Layers with nothing in a list do not need the calls that describe it. */
const hasItems = (v: unknown): boolean => Array.isArray(v) && v.length > 0;

function readStrokes(n: unknown, layerId: string, t: Tracker): LayerStrokes | undefined {
  const raw = read(n, 'strokes');
  // Most layers have no stroke: skip the three calls (style id, weight, alignment) that only matter
  // when there is one. Each call into Figma costs, and a large file has hundreds of thousands of layers.
  if (Array.isArray(raw) && raw.length === 0) return { paints: [], weight: 0, align: 'INSIDE' };
  const paints = readPaints(raw, str(n, 'strokeStyleId'), layerId, t);
  if (!paints) return undefined;
  return {
    paints,
    // strokeWeight is figma.mixed when sides differ; use the largest side then.
    weight: round2(
      num(n, 'strokeWeight') ??
        Math.max(
          0,
          ...['strokeTopWeight', 'strokeRightWeight', 'strokeBottomWeight', 'strokeLeftWeight'].map(
            (k) => num(n, k) ?? 0,
          ),
        ),
    ),
    align: oneOf(read(n, 'strokeAlign'), ['INSIDE', 'CENTER', 'OUTSIDE'] as const, 'INSIDE'),
  };
}

function readRadius(n: unknown): number | CornerRadii | undefined {
  const uniform = num(n, 'cornerRadius');
  if (uniform !== undefined) return uniform > 0 ? round2(uniform) : undefined;
  const corners = ['topLeftRadius', 'topRightRadius', 'bottomRightRadius', 'bottomLeftRadius'].map(
    (k) => num(n, k),
  );
  if (corners.some((c) => c === undefined)) return undefined;
  const [tl, tr, br, bl] = corners.map((c) => round2(c!));
  if (tl === tr && tr === br && br === bl) return tl > 0 ? tl : undefined;
  return { tl, tr, br, bl };
}

function readLayout(n: unknown): LayerLayout | undefined {
  const mode = read(n, 'layoutMode');
  if (mode !== 'HORIZONTAL' && mode !== 'VERTICAL') return undefined;
  const pad = (k: string) => round2(num(n, k) ?? 0);
  return {
    mode,
    gap: round2(num(n, 'itemSpacing') ?? 0),
    padding: {
      top: pad('paddingTop'),
      right: pad('paddingRight'),
      bottom: pad('paddingBottom'),
      left: pad('paddingLeft'),
    },
    primaryAlign: oneOf(
      read(n, 'primaryAxisAlignItems'),
      ['MIN', 'CENTER', 'MAX', 'SPACE_BETWEEN'] as const,
      'MIN',
    ),
    counterAlign: oneOf(
      read(n, 'counterAxisAlignItems'),
      ['MIN', 'CENTER', 'MAX', 'BASELINE'] as const,
      'MIN',
    ),
    sizingH: oneOf(read(n, 'layoutSizingHorizontal'), ['FIXED', 'HUG', 'FILL'] as const, 'FIXED'),
    sizingV: oneOf(read(n, 'layoutSizingVertical'), ['FIXED', 'HUG', 'FILL'] as const, 'FIXED'),
    wrap: read(n, 'layoutWrap') === 'WRAP',
  };
}

function unitValue(v: unknown): UnitValue {
  const unit = read(v, 'unit');
  const value = num(v, 'value') ?? 0;
  if (unit === 'AUTO') return { value: 0, unit: 'auto' };
  if (unit === 'PERCENT') return { value: round2(value), unit: 'percent' };
  return { value: round2(value), unit: 'px' };
}

/** Text fields for a node or a styled segment. Returns undefined when a field is figma.mixed. */
function textFields(
  src: unknown,
  layerId: string,
  t: Tracker,
  styleIdKey: string,
): TextStyleFields | undefined {
  const fontName = read(src, 'fontName');
  const family = str(fontName, 'family');
  const fontSize = num(src, 'fontSize');
  const fontWeight = num(src, 'fontWeight');
  const lineHeight = read(src, 'lineHeight');
  const letterSpacing = read(src, 'letterSpacing');
  if (
    family === undefined ||
    fontSize === undefined ||
    typeof lineHeight !== 'object' ||
    typeof letterSpacing !== 'object'
  ) {
    return undefined;
  }
  const fields: TextStyleFields = {
    fontFamily: family,
    fontWeight: fontWeight ?? 400,
    fontSize: round2(fontSize),
    lineHeight: unitValue(lineHeight),
    letterSpacing: unitValue(letterSpacing),
    textCase: oneOf(
      read(src, 'textCase'),
      ['ORIGINAL', 'UPPER', 'LOWER', 'TITLE', 'SMALL_CAPS', 'SMALL_CAPS_FORCED'] as const,
      'ORIGINAL',
    ),
    textDecoration: oneOf(
      read(src, 'textDecoration'),
      ['NONE', 'UNDERLINE', 'STRIKETHROUGH'] as const,
      'NONE',
    ),
  };
  const styleId = str(src, styleIdKey);
  if (styleId) {
    const token = t.token('style', styleId, layerId);
    if (token) {
      fields.styleId = styleId;
      fields.token = token;
    } else if (!t.resolves) {
      // Nothing to look styles up with (a caller that wants no tokens): keep the raw id.
      fields.styleId = styleId;
    }
    // Otherwise the style is not in this file's tokens (a library style, say): the id would point
    // outside the file, so it is left out and t.token has already warned. The values stay.
  }
  return fields;
}

const SEGMENT_FIELDS = [
  'fontName',
  'fontWeight',
  'fontSize',
  'lineHeight',
  'letterSpacing',
  'textCase',
  'textDecoration',
  'textStyleId',
];

function readText(n: unknown, layerId: string, includeText: boolean, t: Tracker): LayerText {
  const align = oneOf(
    read(n, 'textAlignHorizontal'),
    ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const,
    'LEFT',
  );
  const characters = includeText ? str(n, 'characters') : undefined;
  const whole = textFields(n, layerId, t, 'textStyleId');
  if (whole) {
    const text: LayerText = { ...whole, align };
    if (characters !== undefined) text.characters = characters;
    return text;
  }

  // Mixed styles: read the styled segments and report them as runs.
  let segments: unknown[] = [];
  try {
    const getter = read(n, 'getStyledTextSegments');
    if (typeof getter === 'function') {
      const result = (getter as (f: string[]) => unknown).call(n, SEGMENT_FIELDS);
      if (Array.isArray(result)) segments = result;
    }
  } catch {
    segments = [];
  }
  const runs: TextRun[] = [];
  for (const seg of segments) {
    const fields = textFields(seg, layerId, t, 'textStyleId');
    if (fields)
      runs.push({ ...fields, characters: includeText ? (str(seg, 'characters') ?? '') : '' });
  }
  if (runs.length === 0) {
    return {
      fontFamily: '',
      fontWeight: 400,
      fontSize: 0,
      lineHeight: { value: 0, unit: 'auto' },
      letterSpacing: { value: 0, unit: 'px' },
      textCase: 'ORIGINAL',
      textDecoration: 'NONE',
      align,
      mixed: true,
      runs: [],
    };
  }
  const { characters: _first, ...first } = runs[0];
  void _first;
  const text: LayerText = { ...first, align, mixed: true, runs };
  if (characters !== undefined) text.characters = characters;
  return text;
}

function readPropertyRefs(n: unknown): PropertyRefs | undefined {
  const refs = read(n, 'componentPropertyReferences');
  if (!refs || typeof refs !== 'object') return undefined;
  const out: PropertyRefs = {};
  for (const key of ['characters', 'visible', 'mainComponent'] as const) {
    const v = (refs as Node)[key];
    if (typeof v === 'string') out[key] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

async function readInstance(n: unknown): Promise<Layer['instanceOf']> {
  if (read(n, 'type') !== 'INSTANCE') return undefined;
  let main: unknown;
  try {
    const getter = read(n, 'getMainComponentAsync');
    main =
      typeof getter === 'function'
        ? await (getter as () => Promise<unknown>).call(n)
        : read(n, 'mainComponent');
  } catch {
    return undefined;
  }
  const componentId = str(main, 'id');
  if (!componentId) return undefined;
  // A variant is named "state=hover"; the set's name is the useful one.
  const parent = read(main, 'parent');
  const componentName =
    read(parent, 'type') === 'COMPONENT_SET'
      ? (str(parent, 'name') ?? '')
      : (str(main, 'name') ?? '');
  return { componentId, componentName };
}

function childrenOf(n: unknown): unknown[] {
  const kids = read(n, 'children');
  return Array.isArray(kids) ? kids : [];
}

/** Reads the layer tree under `root`, within the layer and depth budgets. */
export async function readLayerTree(
  root: unknown,
  options: ReadLayerOptions = {},
): Promise<ReadLayerResult> {
  const includeText = options.includeText !== false;
  const maxLayers = options.maxLayers ?? MAX_LAYERS;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const t = new Tracker(options.resolveToken);
  let count = 0;
  let truncated = false;

  const visit = async (n: unknown, depth: number, insideInstance: boolean): Promise<Layer> => {
    count++;
    if (options.yieldIfDue) await options.yieldIfDue();
    if (options.stats) options.stats.layers++;
    const id = str(n, 'id') ?? '';
    const type = str(n, 'type') ?? 'UNKNOWN';
    const layer: Layer = {
      id,
      name: str(n, 'name') ?? '',
      type,
      visible: read(n, 'visible') !== false,
      children: [],
    };

    const width = num(n, 'width');
    const height = num(n, 'height');
    if (width !== undefined && height !== undefined) {
      layer.size = { width: round2(width), height: round2(height) };
    }
    const layout = readLayout(n);
    if (layout) layer.layout = layout;
    const radius = readRadius(n);
    if (radius !== undefined) layer.radius = radius;
    const opacity = num(n, 'opacity');
    if (opacity !== undefined) layer.opacity = round3(opacity);

    const rawFills = read(n, 'fills');
    const fills = readPaints(
      rawFills,
      hasItems(rawFills) ? str(n, 'fillStyleId') : undefined,
      id,
      t,
    );
    if (fills) layer.fills = fills;
    const strokes = readStrokes(n, id, t);
    if (strokes) layer.strokes = strokes;
    const rawEffects = read(n, 'effects');
    const effects = readEffects(
      rawEffects,
      hasItems(rawEffects) ? str(n, 'effectStyleId') : undefined,
      id,
      t,
    );
    if (effects) layer.effects = effects;

    if (type === 'TEXT') layer.text = readText(n, id, includeText, t);
    const stats = options.stats;
    const lookupStart = stats ? Date.now() : 0;
    const instanceOf = await readInstance(n);
    if (stats && type === 'INSTANCE') {
      stats.instanceLookups++;
      stats.instanceMs += Date.now() - lookupStart;
    }
    if (instanceOf) layer.instanceOf = instanceOf;
    // A layer inside a nested instance is driven by the nested component's properties, not by this
    // component's, so its references would point at keys this file does not have. The instance
    // layer itself is driven by this component, and keeps its references.
    const propertyRefs = insideInstance ? undefined : readPropertyRefs(n);
    if (propertyRefs) layer.propertyRefs = propertyRefs;

    const kids =
      type === 'INSTANCE' && options.includeInstanceInternals === false ? [] : childrenOf(n);
    if (kids.length > 0) {
      if (depth >= maxDepth) {
        truncated = true;
      } else {
        for (const child of kids) {
          if (count >= maxLayers || options.shouldStop?.()) {
            truncated = true;
            break;
          }
          layer.children.push(await visit(child, depth + 1, insideInstance || type === 'INSTANCE'));
        }
      }
    }
    return layer;
  };

  const tree = await visit(root, 0, false);
  if (options.stats) options.stats.trees++;
  const warnings = t.warnings;
  if (truncated) {
    warnings.push({
      code: 'TREE_TRUNCATED',
      message: `The layer tree of "${tree.name}" is larger than the budget (${maxLayers} layers, ${maxDepth} levels deep), so it is incomplete.`,
      layerId: tree.id,
    });
  }
  return {
    tree,
    truncated,
    usedVariableIds: Array.from(t.variables),
    usedStyleIds: Array.from(t.styles),
    warnings,
  };
}
