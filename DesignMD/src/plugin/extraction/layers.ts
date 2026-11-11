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
  GradientStop,
  LayerConstraints,
  LayerGrid,
  LayerPlacement,
  SizeLimits,
  InstanceOf,
  InstanceOverride,
  InstanceProperty,
  Layer,
  LayerChanges,
  LayerEffect,
  LayerImage,
  LayerLayout,
  LayerPaint,
  LayerStrokes,
  LayerText,
  PropertyRefs,
  TextRun,
  TextStyleFields,
  TokenRef,
  UnitValue,
  VectorPath,
} from '@shared/componentsSchema';

/** Layers and levels read per component tree. A component over either is flagged `treeTruncated`. */
export const MAX_LAYERS = 2000;
export const MAX_DEPTH = 16;
/** Characters of path data kept for one layer (fill and stroke together). A layer over it is left without a shape. */
export const MAX_VECTOR_CHARS = 60_000;
/** Overrides listed for one instance. */
export const MAX_OVERRIDES = 100;

/** Layer types that have a drawn shape worth exporting. Rectangles and ellipses are described by size and radius. */
/** Layer types that can clip their content and carry layout grids. */
const CLIPPING_TYPES = new Set(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION']);

const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'LINE']);

/** What the caller found out about one image: where its file is, or why there is none. */
export type ImageResolution =
  { file: string; width?: number; height?: number } | { omitted: string };

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
  /** Include the drawn shape (fill and stroke paths) of vector layers. Default false. */
  includeVectorShapes?: boolean;
  /**
   * Exports the picture behind an image fill and says where its file is. Without it, image paints
   * carry the hash and scale mode only.
   */
  resolveImage?: (hash: string) => Promise<ImageResolution>;
  /**
   * Finds a node by id, to read the layers an instance changed. Without it, instances list their
   * property values but no overrides.
   */
  getNodeById?: (id: string) => Promise<unknown>;
  /** Overrides listed per instance. Default MAX_OVERRIDES. */
  maxOverrides?: number;
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
  constructor(
    private resolve: ReadLayerOptions['resolveToken'],
    /** Whether image paints carry their picture details (only when pictures are exported). */
    readonly images = false,
  ) {}

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

const MAX_GRADIENT_STOPS = 32;

/** A 2x3 matrix of finite numbers, rounded, or undefined. */
function matrix2x3(v: unknown): number[][] | undefined {
  if (!Array.isArray(v) || v.length !== 2) return undefined;
  const rows = v.map((row) =>
    Array.isArray(row) &&
    row.length === 3 &&
    row.every((x) => typeof x === 'number' && Number.isFinite(x))
      ? (row as number[]).map((x) => Math.round(x * 10000) / 10000)
      : undefined,
  );
  return rows.every((r) => r) ? (rows as number[][]) : undefined;
}

function readImage(p: unknown): LayerImage | undefined {
  const hash = str(p, 'imageHash');
  if (!hash) return undefined;
  const image: LayerImage = {
    hash,
    scaleMode: oneOf(read(p, 'scaleMode'), ['FILL', 'FIT', 'CROP', 'TILE'] as const, 'FILL'),
  };
  const rotation = num(p, 'rotation');
  if (rotation) image.rotation = round2(rotation);
  const scale = num(p, 'scalingFactor');
  if (image.scaleMode === 'TILE' && scale !== undefined) image.scalingFactor = round3(scale);
  const transform = read(p, 'imageTransform');
  if (image.scaleMode === 'CROP' && Array.isArray(transform)) {
    const rows = transform.map((row) =>
      Array.isArray(row) ? row.map((v) => (typeof v === 'number' ? round3(v) : 0)) : [],
    );
    if (rows.length === 2 && rows.every((r) => r.length === 3)) image.imageTransform = rows;
  }
  return image;
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
      const readStops: GradientStop[] = [];
      if (Array.isArray(stops)) {
        for (const stop of stops.slice(0, MAX_GRADIENT_STOPS)) {
          const color = rgba(read(stop, 'color'));
          const position = num(stop, 'position');
          if (color && position !== undefined)
            readStops.push({ position: round3(position), color });
        }
      }
      if (readStops.length > 0) paint.stops = readStops;
      const transform = matrix2x3(read(p, 'gradientTransform'));
      if (transform) paint.transform = transform;
      const opacity = num(p, 'opacity');
      if (opacity !== undefined && opacity !== 1) paint.alpha = round3(opacity);
    } else if (type === 'IMAGE') {
      paint.description = `image, scale mode ${str(p, 'scaleMode') ?? 'unknown'}`;
      const image = t.images ? readImage(p) : undefined;
      if (image) paint.image = image;
      const opacity = num(p, 'opacity');
      if (opacity !== undefined && opacity !== 1) paint.alpha = round3(opacity);
    }
    const blend = str(p, 'blendMode');
    if (blend && blend !== 'NORMAL') paint.blendMode = blend;
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
  const sides = {
    top: num(n, 'strokeTopWeight'),
    right: num(n, 'strokeRightWeight'),
    bottom: num(n, 'strokeBottomWeight'),
    left: num(n, 'strokeLeftWeight'),
  };
  const sideValues = Object.values(sides).map((v) => v ?? 0);
  const strokes: LayerStrokes = {
    paints,
    // strokeWeight is figma.mixed when sides differ; use the largest side then.
    weight: round2(num(n, 'strokeWeight') ?? Math.max(0, ...sideValues)),
    align: oneOf(read(n, 'strokeAlign'), ['INSIDE', 'CENTER', 'OUTSIDE'] as const, 'INSIDE'),
  };
  if (
    paints.length > 0 &&
    Object.values(sides).every((v) => v !== undefined) &&
    new Set(sideValues).size > 1
  ) {
    strokes.sides = {
      top: round2(sides.top!),
      right: round2(sides.right!),
      bottom: round2(sides.bottom!),
      left: round2(sides.left!),
    };
  }
  if (paints.length > 0) {
    const dashes = read(n, 'dashPattern');
    if (Array.isArray(dashes) && dashes.length > 0 && dashes.every((d) => typeof d === 'number')) {
      strokes.dash = (dashes as number[]).map(round2);
    }
    const cap = str(n, 'strokeCap');
    if (cap && cap !== 'NONE') strokes.cap = cap;
    const join = str(n, 'strokeJoin');
    if (join && join !== 'MITER') strokes.join = join;
    const miter = num(n, 'strokeMiterLimit');
    if (join === 'MITER' && miter !== undefined && miter !== 4) strokes.miterLimit = round2(miter);
  }
  return strokes;
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
    ...layoutExtras(n),
  };
}

function layoutExtras(n: unknown): Partial<LayerLayout> {
  const out: Partial<LayerLayout> = {};
  if (read(n, 'layoutWrap') === 'WRAP') {
    const gap = num(n, 'counterAxisSpacing');
    if (gap !== undefined) out.counterGap = round2(gap);
    const content = read(n, 'counterAxisAlignContent');
    if (content === 'AUTO' || content === 'SPACE_BETWEEN') out.counterAlignContent = content;
  }
  if (read(n, 'itemReverseZIndex') === true) out.reverseZIndex = true;
  if (read(n, 'strokesIncludedInLayout') === true) out.strokesIncludedInLayout = true;
  return out;
}

const AUTO_LAYOUT_MODES = ['HORIZONTAL', 'VERTICAL'];
const isAutoLayout = (n: unknown): boolean =>
  AUTO_LAYOUT_MODES.includes(read(n, 'layoutMode') as string);

function readPlacement(n: unknown): LayerPlacement {
  return {
    positioning: read(n, 'layoutPositioning') === 'ABSOLUTE' ? 'ABSOLUTE' : 'AUTO',
    grow: num(n, 'layoutGrow') ?? 0,
    align: oneOf(
      read(n, 'layoutAlign'),
      ['INHERIT', 'STRETCH', 'MIN', 'CENTER', 'MAX'] as const,
      'INHERIT',
    ),
    sizingH: oneOf(read(n, 'layoutSizingHorizontal'), ['FIXED', 'HUG', 'FILL'] as const, 'FIXED'),
    sizingV: oneOf(read(n, 'layoutSizingVertical'), ['FIXED', 'HUG', 'FILL'] as const, 'FIXED'),
  };
}

function readConstraints(n: unknown): LayerConstraints | undefined {
  const c = read(n, 'constraints');
  const kinds = ['MIN', 'CENTER', 'MAX', 'STRETCH', 'SCALE'] as const;
  const h = read(c, 'horizontal');
  const v = read(c, 'vertical');
  if (!kinds.includes(h as never) || !kinds.includes(v as never)) return undefined;
  return {
    horizontal: h as LayerConstraints['horizontal'],
    vertical: v as LayerConstraints['vertical'],
  };
}

function readSizeLimits(n: unknown): SizeLimits | undefined {
  const out: SizeLimits = {};
  for (const key of ['minWidth', 'maxWidth', 'minHeight', 'maxHeight'] as const) {
    const v = num(n, key);
    if (v !== undefined) out[key] = round2(v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function readGrids(n: unknown): LayerGrid[] | undefined {
  const raw = read(n, 'layoutGrids');
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.flatMap((g): LayerGrid[] => {
    const pattern = read(g, 'pattern');
    if (pattern !== 'GRID' && pattern !== 'COLUMNS' && pattern !== 'ROWS') return [];
    const grid: LayerGrid = { pattern, visible: read(g, 'visible') !== false };
    const section = num(g, 'sectionSize');
    if (section !== undefined) grid.sectionSize = round2(section);
    const count = num(g, 'count');
    if (count !== undefined && count > 0 && count < 1e6) grid.count = count;
    const gutter = num(g, 'gutterSize');
    if (gutter !== undefined) grid.gutterSize = round2(gutter);
    const offset = num(g, 'offset');
    if (offset !== undefined) grid.offset = round2(offset);
    const alignment = read(g, 'alignment');
    if (
      alignment === 'MIN' ||
      alignment === 'CENTER' ||
      alignment === 'MAX' ||
      alignment === 'STRETCH'
    ) {
      grid.alignment = alignment;
    }
    return [grid];
  });
}

/** Fields whose bindings are written on the paints, or that are not layer values. */
const NON_NUMERIC_BINDINGS = new Set([
  'fills',
  'strokes',
  'effects',
  'textRangeFills',
  'componentProperties',
]);

/** Variables bound to number, string or boolean fields, as tokens. */
function readBindings(
  n: unknown,
  layerId: string,
  t: Tracker,
): Record<string, TokenRef> | undefined {
  if (!t.resolves) return undefined;
  const bound = read(n, 'boundVariables');
  if (!bound || typeof bound !== 'object') return undefined;
  const out: Record<string, TokenRef> = {};
  for (const field of Object.keys(bound as Node).sort()) {
    if (NON_NUMERIC_BINDINGS.has(field)) continue;
    const alias = (bound as Node)[field];
    const id =
      typeof alias === 'object' && alias !== null && !Array.isArray(alias)
        ? (alias as Node).id
        : undefined;
    const token = typeof id === 'string' ? t.token('variable', id, layerId) : undefined;
    if (token) out[field] = token;
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
  if (/italic|oblique/i.test(str(fontName, 'style') ?? '')) fields.italic = true;
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
  'fills',
  'hyperlink',
  'listOptions',
];

function hyperlinkOf(v: unknown): string | undefined {
  return read(v, 'type') === 'URL' ? str(v, 'value') : undefined;
}
function listTypeOf(v: unknown): 'ORDERED' | 'UNORDERED' | undefined {
  const type = read(v, 'type');
  return type === 'ORDERED' || type === 'UNORDERED' ? type : undefined;
}

/** Box and paragraph settings of a text layer that are not about the font. */
function textBox(n: unknown, includeText: boolean): Partial<LayerText> {
  const out: Partial<LayerText> = {};
  const auto = read(n, 'textAutoResize');
  if (auto === 'NONE' || auto === 'WIDTH_AND_HEIGHT' || auto === 'HEIGHT' || auto === 'TRUNCATE') {
    out.autoResize = auto;
  }
  if (read(n, 'textTruncation') === 'ENDING') out.truncation = 'ENDING';
  const maxLines = num(n, 'maxLines');
  if (maxLines !== undefined && maxLines > 0) out.maxLines = maxLines;
  const vertical = read(n, 'textAlignVertical');
  if (vertical === 'CENTER' || vertical === 'BOTTOM') out.alignVertical = vertical;
  const spacing = num(n, 'paragraphSpacing');
  if (spacing) out.paragraphSpacing = round2(spacing);
  const indent = num(n, 'paragraphIndent');
  if (indent) out.paragraphIndent = round2(indent);
  const link = hyperlinkOf(read(n, 'hyperlink'));
  if (link) out.hyperlink = link;
  if (includeText) {
    const length = (str(n, 'characters') ?? '').length;
    const getter = read(n, 'getRangeListOptions');
    if (length > 0 && typeof getter === 'function') {
      try {
        const list = listTypeOf((getter as (a: number, b: number) => unknown).call(n, 0, length));
        if (list) out.listType = list;
      } catch {
        /* a text layer with unreadable lists is just not a list */
      }
    }
  }
  return out;
}

function readText(
  n: unknown,
  layerId: string,
  includeText: boolean,
  t: Tracker,
  /** True when the text colours differ between runs, so the layer has no single fill. */
  fillsMixed: boolean,
): LayerText {
  const align = oneOf(
    read(n, 'textAlignHorizontal'),
    ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'] as const,
    'LEFT',
  );
  const characters = includeText ? str(n, 'characters') : undefined;
  const box = textBox(n, includeText);
  const whole = fillsMixed ? undefined : textFields(n, layerId, t, 'textStyleId');
  if (whole) {
    const text: LayerText = { ...whole, align, ...box };
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
    if (!fields) continue;
    const run: TextRun = {
      ...fields,
      characters: includeText ? (str(seg, 'characters') ?? '') : '',
    };
    const fills = readPaints(read(seg, 'fills'), undefined, layerId, t);
    if (fills) run.fills = fills;
    const link = hyperlinkOf(read(seg, 'hyperlink'));
    if (link) run.hyperlink = link;
    const list = listTypeOf(read(seg, 'listOptions'));
    if (list) run.listType = list;
    runs.push(run);
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
      ...box,
      mixed: true,
      runs: [],
    };
  }
  // The layer-level fields describe the first run; its colour, link and list kind stay on the run.
  const { characters: _c, fills: _f, hyperlink: _h, listType: _l, ...first } = runs[0];
  void [_c, _f, _h, _l];
  const text: LayerText = { ...first, align, ...box, mixed: true, runs };
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

async function readInstance(n: unknown): Promise<InstanceOf | undefined> {
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
  const instance: InstanceOf = { componentId, componentName };
  const properties = readInstanceProperties(n);
  if (properties) instance.properties = properties;
  return instance;
}

function readPaths(n: unknown, key: string): VectorPath[] | undefined {
  const raw = read(n, key);
  if (!Array.isArray(raw)) return undefined;
  const out: VectorPath[] = [];
  for (const p of raw) {
    const data = str(p, 'data');
    if (data)
      out.push({
        windingRule: oneOf(
          read(p, 'windingRule'),
          ['NONZERO', 'EVENODD', 'NONE'] as const,
          'NONZERO',
        ),
        data,
      });
  }
  return out;
}

/**
 * The drawn shape of a vector layer. Only what the layer paints is read (fill paths when it has a
 * fill, the stroke outline when it has a stroke), because each is a separate call into Figma.
 */
function readVector(n: unknown, layer: Layer, t: Tracker): Layer['vector'] | undefined {
  const fill = hasItems(layer.fills) ? readPaths(n, 'fillGeometry') : [];
  const stroke = hasItems(layer.strokes?.paints) ? readPaths(n, 'strokeGeometry') : [];
  if (!fill || !stroke) return undefined;
  const size = [...fill, ...stroke].reduce((sum, p) => sum + p.data.length, 0);
  if (size === 0) return undefined;
  if (size > MAX_VECTOR_CHARS) {
    t.warnings.push({
      code: 'VECTOR_OMITTED',
      message: `The shape of "${layer.name}" is ${Math.round(size / 1024)} KB of path data (limit ${Math.round(MAX_VECTOR_CHARS / 1024)} KB), so it is left out.`,
      layerId: layer.id,
    });
    return undefined;
  }
  return { fill, stroke };
}

/** Which layer attribute a Figma "overridden field" changes. Fields that change none (name, lock) are not listed. */
function attributeOfField(field: string): keyof LayerChanges | undefined {
  if (field === 'visible') return 'visible';
  if (field === 'opacity') return 'opacity';
  if (field === 'mainComponent' || field === 'componentProperties') return 'instanceOf';
  if (/^(characters|font|lineHeight|letterSpacing|text)/.test(field)) return 'text';
  if (/^(fills|fillStyleId)/.test(field)) return 'fills';
  if (
    /^(strokes|strokeStyleId|strokeWeight|stroke(Top|Right|Bottom|Left)Weight|strokeAlign)/.test(
      field,
    )
  )
    return 'strokes';
  if (/^(effects|effectStyleId)/.test(field)) return 'effects';
  if (/Radius$|^cornerRadius$/.test(field)) return 'radius';
  if (/^(width|height|size)$/.test(field)) return 'size';
  if (field === 'x' || field === 'y' || field === 'relativeTransform') return 'position';
  if (field === 'rotation') return 'rotation';
  if (/^(layoutPositioning|layoutGrow|layoutAlign|layoutSizing)/.test(field)) return 'placement';
  if (field === 'constraints') return 'constraints';
  if (field === 'clipsContent') return 'clipsContent';
  if (field === 'blendMode') return 'blendMode';
  if (
    /^(layoutMode|layoutWrap|padding|itemSpacing|primaryAxis|counterAxis|itemReverse|strokesIncluded)/.test(
      field,
    )
  )
    return 'layout';
  return undefined;
}

function readInstanceProperties(n: unknown): Record<string, InstanceProperty> | undefined {
  const props = read(n, 'componentProperties');
  if (!props || typeof props !== 'object') return undefined;
  const out: Record<string, InstanceProperty> = {};
  for (const key of Object.keys(props as Node).sort()) {
    const entry = (props as Node)[key];
    const type = read(entry, 'type');
    const value = read(entry, 'value');
    if (
      (type === 'BOOLEAN' || type === 'TEXT' || type === 'INSTANCE_SWAP' || type === 'VARIANT') &&
      (typeof value === 'string' || typeof value === 'boolean')
    ) {
      out[key] = { type, value };
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
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
  const t = new Tracker(options.resolveToken, !!options.resolveImage);
  let count = 0;
  let truncated = false;

  const imageOmissions = new Set<string>();

  /** Everything about one layer except its children and its own instance details. */
  /** What the parent of a layer says about how the layer is placed. `undefined` for the root. */
  interface ParentInfo {
    auto: boolean;
  }

  const readAttributes = async (
    n: unknown,
    insideBoolean: boolean,
    parent?: ParentInfo,
  ): Promise<Layer> => {
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

    // Where the layer sits. In an auto-layout parent the flow decides, except for absolute layers.
    const placement = parent?.auto ? readPlacement(n) : undefined;
    if (placement) layer.placement = placement;
    if (parent && (!parent.auto || placement?.positioning === 'ABSOLUTE')) {
      const x = num(n, 'x');
      const y = num(n, 'y');
      if (x !== undefined && y !== undefined) layer.position = { x: round2(x), y: round2(y) };
      const constraints = readConstraints(n);
      if (constraints) layer.constraints = constraints;
    }
    const rotation = num(n, 'rotation');
    if (rotation) layer.rotation = round2(rotation);
    if (layout || placement) {
      const limits = readSizeLimits(n);
      if (limits) layer.sizeLimits = limits;
    }
    if (CLIPPING_TYPES.has(type)) {
      const clips = read(n, 'clipsContent');
      if (typeof clips === 'boolean') layer.clipsContent = clips;
      const grids = readGrids(n);
      if (grids) layer.layoutGrids = grids;
    }
    if (read(n, 'isMask') === true) layer.isMask = true;
    const blend = str(n, 'blendMode');
    if (blend && blend !== 'NORMAL' && blend !== 'PASS_THROUGH') layer.blendMode = blend;
    const smoothing = num(n, 'cornerSmoothing');
    if (smoothing) layer.cornerSmoothing = round3(smoothing);
    const bindings = readBindings(n, id, t);
    if (bindings) layer.bindings = bindings;

    const rawFills = read(n, 'fills');
    const fills = readPaints(
      rawFills,
      hasItems(rawFills) ? str(n, 'fillStyleId') : undefined,
      id,
      t,
    );
    if (fills) {
      layer.fills = fills;
      if (options.resolveImage) {
        for (const paint of fills) {
          if (!paint.image) continue;
          const found = await options.resolveImage(paint.image.hash);
          if ('file' in found) {
            paint.image.file = found.file;
            if (found.width !== undefined) paint.image.width = found.width;
            if (found.height !== undefined) paint.image.height = found.height;
          } else if (!imageOmissions.has(paint.image.hash)) {
            imageOmissions.add(paint.image.hash);
            t.warnings.push({
              code: 'IMAGE_OMITTED',
              message: `The picture used by "${layer.name}" was not exported: ${found.omitted}`,
              layerId: id,
            });
          }
        }
      }
    }
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

    if (type === 'TEXT') layer.text = readText(n, id, includeText, t, !Array.isArray(rawFills));
    // The parts of a boolean shape are already merged into its own path; drawing them again would
    // double the size for nothing.
    if (options.includeVectorShapes && VECTOR_TYPES.has(type) && !insideBoolean) {
      const vector = readVector(n, layer, t);
      if (vector) layer.vector = vector;
    }
    return layer;
  };

  /**
   * What this use of an instance changed inside it. Figma lists the changed layers and fields;
   * each layer is read once and only the attributes those fields touch are kept.
   */
  const readOverrides = async (
    instance: unknown,
    instanceId: string,
  ): Promise<{ overrides: InstanceOverride[]; truncated: boolean } | undefined> => {
    const lookup = options.getNodeById;
    const list = read(instance, 'overrides');
    if (!lookup || !Array.isArray(list)) return undefined;
    const overrides: InstanceOverride[] = [];
    let truncated = false;
    for (const entry of list) {
      const layerId = str(entry, 'id');
      const fields = read(entry, 'overriddenFields');
      if (!layerId || layerId === instanceId || !Array.isArray(fields)) continue;
      const wanted = new Set<keyof LayerChanges>();
      for (const f of fields) {
        const attribute = typeof f === 'string' ? attributeOfField(f) : undefined;
        if (attribute) wanted.add(attribute);
      }
      if (wanted.size === 0) continue;
      if (overrides.length >= (options.maxOverrides ?? MAX_OVERRIDES)) {
        truncated = true;
        break;
      }
      if (options.shouldStop?.()) {
        truncated = true;
        break;
      }
      if (options.yieldIfDue) await options.yieldIfDue();
      let node: unknown;
      try {
        node = await lookup(layerId);
      } catch {
        node = undefined;
      }
      if (!node) continue;
      const layer = await readAttributes(node, true, {
        auto: isAutoLayout(read(node, 'parent')),
      });
      const changes: Record<string, unknown> = {};
      for (const attribute of wanted) {
        if (attribute === 'instanceOf') {
          const inst = await readInstance(node);
          if (inst) changes.instanceOf = inst;
        } else if (layer[attribute as keyof Layer] !== undefined) {
          changes[attribute] = layer[attribute as keyof Layer];
        }
      }
      if (Object.keys(changes).length > 0) {
        overrides.push({ layerId, name: layer.name, changes: changes as LayerChanges });
      }
    }
    return overrides.length > 0 || truncated ? { overrides, truncated } : undefined;
  };

  const visit = async (
    n: unknown,
    depth: number,
    insideInstance: boolean,
    insideBoolean = false,
    parent?: ParentInfo,
  ): Promise<Layer> => {
    count++;
    if (options.yieldIfDue) await options.yieldIfDue();
    if (options.stats) options.stats.layers++;
    const layer = await readAttributes(n, insideBoolean, parent);
    const { id, type } = layer;

    const stats = options.stats;
    const lookupStart = stats ? Date.now() : 0;
    const instanceOf = await readInstance(n);
    if (stats && type === 'INSTANCE') {
      stats.instanceLookups++;
      stats.instanceMs += Date.now() - lookupStart;
    }
    if (instanceOf) {
      // Layers read inside the instance carry their own values; only an instance whose insides
      // are not read needs its changes listed.
      if (options.includeInstanceInternals === false) {
        const found = await readOverrides(n, id);
        if (found) {
          if (found.overrides.length > 0) instanceOf.overrides = found.overrides;
          if (found.truncated) instanceOf.overridesTruncated = true;
        }
      }
      layer.instanceOf = instanceOf;
    }
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
          layer.children.push(
            await visit(
              child,
              depth + 1,
              insideInstance || type === 'INSTANCE',
              insideBoolean || type === 'BOOLEAN_OPERATION',
              { auto: !!layer.layout },
            ),
          );
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
