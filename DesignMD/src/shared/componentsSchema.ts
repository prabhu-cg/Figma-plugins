/**
 * Types for the `designmd.components/v1` output (components.json).
 *
 * This file is the single source of truth: schemas/designmd-components-v1.json is generated
 * from it (npm run schema) and CI checks that the two agree. Every property needs a JSDoc
 * description, because the schema is meant to be read by people and AI tools.
 *
 * Rules that apply to every type here (see docs/components-json.md):
 * - Lengths are plain numbers in px. Other units use { value, unit }.
 * - Colors are ColorRgba, never 8-digit hex strings.
 * - A field has one type. A missing field means "not applicable"; null means "applies, no value".
 * - Arrays are always written, so [] means "none".
 */

/** The schema identifier written to every file. */
export const COMPONENTS_SCHEMA_ID = 'designmd.components/v1';

/** Where the published JSON Schema lives; written to `$schema` in every file. */
export const COMPONENTS_SCHEMA_URL =
  'https://raw.githubusercontent.com/prabhu-cg/Figma-plugins/main/DesignMD/schemas/designmd-components-v1.json';

/** A color with explicit alpha. */
export interface ColorRgba {
  /** Six-digit lowercase hex without alpha, for example "#1252f7". */
  hex: string;
  /** Opacity from 0 to 1. */
  alpha: number;
  /** Red channel, 0 to 255. */
  r: number;
  /** Green channel, 0 to 255. */
  g: number;
  /** Blue channel, 0 to 255. */
  b: number;
}

/** A length with an explicit unit. */
export interface UnitValue {
  /** The numeric value. */
  value: number;
  /** "px" for pixels, "percent" for a percentage of the font size, "auto" when the value is automatic (value is 0). */
  unit: 'px' | 'percent' | 'auto';
}

/** A reference to a design token. At least one of variableId and styleId is present. */
export interface TokenRef {
  /** Figma variable id. Also the key of this token in the file's `tokens` lookup. */
  variableId?: string;
  /** Figma style id. Also the key of this token in the file's `tokens` lookup. */
  styleId?: string;
  /** CSS custom property name, for example "--color-primary-500". */
  cssName: string;
}

/** A color token, resolved for the default mode. */
export interface ColorTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** True for a style from a library the file uses, not defined in this file. */
  library?: boolean;
  /** Token type. */
  type: 'color';
  /** The resolved default-mode value. */
  value: ColorRgba;
}

/** A numeric token, resolved for the default mode. */
export interface NumberTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** True for a style from a library the file uses, not defined in this file. */
  library?: boolean;
  /** "dimension" is a length in px; "number" is unitless. */
  type: 'dimension' | 'number';
  /** The resolved default-mode value. */
  value: number;
}

/** A string token, resolved for the default mode. */
export interface StringTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** True for a style from a library the file uses, not defined in this file. */
  library?: boolean;
  /** Token type. */
  type: 'string' | 'fontFamily';
  /** The resolved default-mode value. */
  value: string;
}

/** A boolean token, resolved for the default mode. */
export interface BooleanTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** True for a style from a library the file uses, not defined in this file. */
  library?: boolean;
  /** Token type. */
  type: 'boolean';
  /** The resolved default-mode value. */
  value: boolean;
}

/** A style token (text, effect, gradient) as flat key-value pairs. Full detail is in tokens.json. */
export interface CompositeTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** True for a style from a library the file uses, not defined in this file. */
  library?: boolean;
  /** Token type. */
  type: 'typography' | 'shadow' | 'gradient' | 'grid';
  /** Flat summary of the style. Numbers are px unless the key says otherwise. */
  value: Record<string, string | number | boolean>;
}

/** One entry of the `tokens` lookup. */
export type TokenEntry =
  ColorTokenEntry | NumberTokenEntry | StringTokenEntry | BooleanTokenEntry | CompositeTokenEntry;

/** Padding in px. */
export interface Padding {
  /** Top padding. */
  top: number;
  /** Right padding. */
  right: number;
  /** Bottom padding. */
  bottom: number;
  /** Left padding. */
  left: number;
}

/** Auto-layout settings. Present only on auto-layout frames. */
export interface LayerLayout {
  /** Direction of the auto layout. */
  mode: 'HORIZONTAL' | 'VERTICAL';
  /** Space between children, in px. */
  gap: number;
  /** Padding, in px. */
  padding: Padding;
  /** Alignment along the layout direction. */
  primaryAlign: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  /** Alignment across the layout direction. */
  counterAlign: 'MIN' | 'CENTER' | 'MAX' | 'BASELINE';
  /** Horizontal sizing: fixed size, hug the content, or fill the parent. */
  sizingH: 'FIXED' | 'HUG' | 'FILL';
  /** Vertical sizing: fixed size, hug the content, or fill the parent. */
  sizingV: 'FIXED' | 'HUG' | 'FILL';
  /** True when children wrap onto new lines. */
  wrap: boolean;
  /** Space between wrapped lines, in px. Only when `wrap` is true. */
  counterGap?: number;
  /** How wrapped lines are spread across the frame. Only when `wrap` is true. */
  counterAlignContent?: 'AUTO' | 'SPACE_BETWEEN';
  /** True when the first child is drawn on top instead of last. Absent means false. */
  reverseZIndex?: boolean;
  /** True when the stroke takes up space in the layout (like CSS border-box). Absent means false: the stroke does not. */
  strokesIncludedInLayout?: boolean;
}

/** How a layer sits inside its auto-layout parent. Only on children of an auto-layout frame. */
export interface LayerPlacement {
  /** "ABSOLUTE" takes the layer out of the flow, positioned by `position` and `constraints`. */
  positioning: 'AUTO' | 'ABSOLUTE';
  /** 1 when the layer grows to fill the free space along the layout direction, else 0. */
  grow: number;
  /** "STRETCH" fills the parent across the layout direction. Otherwise the parent's counter alignment applies. */
  align: 'INHERIT' | 'STRETCH' | 'MIN' | 'CENTER' | 'MAX';
  /** Horizontal sizing: fixed size, hug the content, or fill the parent. For any layer, not only frames. */
  sizingH: 'FIXED' | 'HUG' | 'FILL';
  /** Vertical sizing: fixed size, hug the content, or fill the parent. For any layer, not only frames. */
  sizingV: 'FIXED' | 'HUG' | 'FILL';
}

/** Position of a layer inside its parent, in px, from the parent's top-left corner. */
export interface LayerPosition {
  /** Distance from the parent's left edge. */
  x: number;
  /** Distance from the parent's top edge. */
  y: number;
}

/** How a layer follows its parent when the parent is resized. Not used in auto layout, unless the layer is absolute. */
export interface LayerConstraints {
  /** Horizontal behaviour. MIN pins left, MAX pins right. */
  horizontal: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
  /** Vertical behaviour. MIN pins top, MAX pins bottom. */
  vertical: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH' | 'SCALE';
}

/** Minimum and maximum size in px. Only the limits that are set. */
export interface SizeLimits {
  /** Minimum width. */
  minWidth?: number;
  /** Maximum width. */
  maxWidth?: number;
  /** Minimum height. */
  minHeight?: number;
  /** Maximum height. */
  maxHeight?: number;
}

/** A layout grid on a frame. */
export interface LayerGrid {
  /** Grid kind. */
  pattern: 'GRID' | 'COLUMNS' | 'ROWS';
  /** Whether the grid is shown. */
  visible: boolean;
  /** Cell size for GRID, column width or row height for COLUMNS and ROWS, in px. */
  sectionSize?: number;
  /** Number of columns or rows. Absent when it is automatic. */
  count?: number;
  /** Space between columns or rows, in px. */
  gutterSize?: number;
  /** Distance from the edge to the first column or row, in px. */
  offset?: number;
  /** Where columns or rows sit when they do not fill the frame. */
  alignment?: 'MIN' | 'CENTER' | 'MAX' | 'STRETCH';
}

/** One colour stop of a gradient. */
export interface GradientStop {
  /** Position along the gradient, 0 to 1. */
  position: number;
  /** The colour at this stop, with its own alpha. */
  color: ColorRgba;
}

/** The picture behind an IMAGE paint. The bytes are a separate file, and only when "Include images" is on. */
export interface LayerImage {
  /** Figma image hash. The same picture has the same hash everywhere in the file. */
  hash: string;
  /** How the picture fills the layer. */
  scaleMode: 'FILL' | 'FIT' | 'CROP' | 'TILE';
  /** Path of the exported picture relative to the export root, for example "assets/images/3f2a.png". Absent when images were not exported or this one was left out (see IMAGE_OMITTED). */
  file?: string;
  /** Pixel width of the picture. Present with `file`. */
  width?: number;
  /** Pixel height of the picture. Present with `file`. */
  height?: number;
  /** Rotation of the picture in degrees, when it is rotated. */
  rotation?: number;
  /** Scale of one tile, for TILE. */
  scalingFactor?: number;
  /** For CROP: the 2x3 matrix that places the picture, as Figma reports it. */
  imageTransform?: number[][];
}

/** A fill or stroke paint. Image bytes are never inside this file; see LayerImage. */
export interface LayerPaint {
  /** Figma paint type. */
  type:
    | 'SOLID'
    | 'GRADIENT_LINEAR'
    | 'GRADIENT_RADIAL'
    | 'GRADIENT_ANGULAR'
    | 'GRADIENT_DIAMOND'
    | 'IMAGE'
    | 'VIDEO'
    | 'PATTERN';
  /** Whether the paint is visible. */
  visible: boolean;
  /** Six-digit lowercase hex without alpha, for SOLID paints. */
  hex?: string;
  /** Opacity of the whole paint, 0 to 1. For SOLID paints this is the colour's opacity. Absent on gradients and images means 1. */
  alpha?: number;
  /** Short human-readable description of a gradient or image paint. */
  description?: string;
  /** Colour stops, for gradient paints. */
  stops?: GradientStop[];
  /** Maps the gradient onto the layer, as the 2x3 matrix Figma reports (`gradientTransform`). It takes layer space (0 to 1) to gradient space, so a consumer inverts it to find the start and end points. */
  transform?: number[][];
  /** How the paint blends with what is under it. Absent means NORMAL. */
  blendMode?: string;
  /** The picture, for IMAGE paints. */
  image?: LayerImage;
  /** The token this paint is bound to, when it is. */
  token?: TokenRef;
}

/** Stroke settings. */
export interface LayerStrokes {
  /** The stroke paints. */
  paints: LayerPaint[];
  /** Stroke weight in px. */
  weight: number;
  /** Where the stroke sits relative to the edge. */
  align: 'INSIDE' | 'CENTER' | 'OUTSIDE';
  /** Weight of each side in px, written when the sides differ. `weight` is then the largest of them. */
  sides?: Padding;
  /** Dash pattern in px (dash, gap, dash, ...). Absent for a solid stroke. */
  dash?: number[];
  /** End shape of an open stroke, as Figma names it: ROUND, SQUARE, ARROW_LINES or ARROW_EQUILATERAL. Absent means NONE (flat). */
  cap?: string;
  /** Corner shape, as Figma names it: BEVEL or ROUND. Absent means MITER. */
  join?: string;
  /** Miter limit, when the join is MITER (absent) and it is not the default of 4. */
  miterLimit?: number;
}

/** A shadow or blur effect. */
export interface LayerEffect {
  /** Figma effect type. */
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  /** Whether the effect is visible. */
  visible: boolean;
  /** Shadow color. Absent for blurs. */
  color?: ColorRgba;
  /** Horizontal shadow offset in px. */
  offsetX?: number;
  /** Vertical shadow offset in px. */
  offsetY?: number;
  /** Blur radius in px. */
  radius: number;
  /** Shadow spread in px. */
  spread?: number;
  /** The effect style this effect comes from, when it does. */
  token?: TokenRef;
}

/** Per-corner radii in px, used when the corners differ. */
export interface CornerRadii {
  /** Top-left radius. */
  tl: number;
  /** Top-right radius. */
  tr: number;
  /** Bottom-right radius. */
  br: number;
  /** Bottom-left radius. */
  bl: number;
}

/** Text properties shared by a whole text layer and by one run inside it. */
export interface TextStyleFields {
  /** Figma text style id, when one is applied. */
  styleId?: string;
  /** Font family name. Empty when the font could not be read. */
  fontFamily: string;
  /** Numeric font weight, for example 600. */
  fontWeight: number;
  /** Font size in px. */
  fontSize: number;
  /** Line height. */
  lineHeight: UnitValue;
  /** Letter spacing. */
  letterSpacing: UnitValue;
  /** Text case transform. */
  textCase: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE' | 'SMALL_CAPS' | 'SMALL_CAPS_FORCED';
  /** Text decoration. */
  textDecoration: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
  /** True for an italic or oblique font style. Absent means upright. */
  italic?: boolean;
  /** The text style token, when styleId resolves to a token in the file. */
  token?: TokenRef;
}

/** A stretch of text with its own style, used when a text layer mixes styles. */
export interface TextRun extends TextStyleFields {
  /** The characters of this run. */
  characters: string;
  /** Colour of this run. Written when the layer's text colours differ between runs. */
  fills?: LayerPaint[];
  /** URL this run links to. */
  hyperlink?: string;
  /** List kind of this run's paragraph, when it is a list. */
  listType?: 'ORDERED' | 'UNORDERED';
}

/** Text properties of a TEXT layer. */
export interface LayerText extends TextStyleFields {
  /** The text content. Absent when "Include text content" is off. */
  characters?: string;
  /** Horizontal alignment. */
  align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  /** How the box follows the text: NONE is a fixed box, WIDTH_AND_HEIGHT hugs both, HEIGHT hugs the height (fixed width, wraps), TRUNCATE is fixed and cuts off. */
  autoResize?: 'NONE' | 'WIDTH_AND_HEIGHT' | 'HEIGHT' | 'TRUNCATE';
  /** "ENDING" cuts overflowing text with an ellipsis. Absent means no truncation. */
  truncation?: 'ENDING';
  /** Most lines shown before truncating. Absent means no limit. */
  maxLines?: number;
  /** Vertical alignment inside the box. Absent means TOP. */
  alignVertical?: 'CENTER' | 'BOTTOM';
  /** Space between paragraphs in px. Absent means 0. */
  paragraphSpacing?: number;
  /** Indent of the first line of a paragraph in px. Absent means 0. */
  paragraphIndent?: number;
  /** List kind, when the whole text is a list. */
  listType?: 'ORDERED' | 'UNORDERED';
  /** URL the whole text links to. */
  hyperlink?: string;
  /** True when the layer mixes styles. The fields above then describe the first run. */
  mixed?: boolean;
  /** One entry per style run, written when `mixed` is true. */
  runs?: TextRun[];
}

/** The value an instance gives one component property. */
export interface InstanceProperty {
  /** Property type. */
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  /** The value in this use of the component. For INSTANCE_SWAP it is the id of the component swapped in. */
  value: string | boolean;
}

/** A layer inside a nested instance that this use of the component changed. */
export interface InstanceOverride {
  /**
   * Figma id of the layer inside the instance, for example "I12:3;45:6". The part after the last
   * ";" is the id of the same layer in the main component.
   */
  layerId: string;
  /** Layer name, for display. */
  name: string;
  /** The attributes this use changed, with the values it has. Same shapes as in Layer. */
  changes: LayerChanges;
}

/** The main component an instance layer points at. */
export interface InstanceOf {
  /** Id of the main component. */
  componentId: string;
  /** Name of the main component, for display. */
  componentName: string;
  /** Property values set in this use of the component, keyed by property key. Absent when the component has none. */
  properties?: Record<string, InstanceProperty>;
  /**
   * What this use changed inside the component, such as a different label. Written only when the
   * layers inside nested instances are not read, because otherwise they carry their own values.
   */
  overrides?: InstanceOverride[];
  /** True when there were more overrides than the limit, so `overrides` is incomplete. */
  overridesTruncated?: boolean;
}

/** Which component property drives which layer attribute. Values are property keys, for example "label#12:0". */
export interface PropertyRefs {
  /** Key of the TEXT property that sets this layer's characters. */
  characters?: string;
  /** Key of the BOOLEAN property that shows or hides this layer. */
  visible?: string;
  /** Key of the INSTANCE_SWAP property that sets this instance's main component. */
  mainComponent?: string;
}

/** What a layer is for. A hint, never a fact. */
export type LayerRole =
  | 'root'
  | 'container'
  | 'heading'
  | 'text'
  | 'label'
  | 'icon'
  | 'image'
  | 'button'
  | 'link'
  | 'input'
  | 'divider'
  | 'slot'
  | 'unknown';

/** How a layer's role was decided. "name" is the lowest confidence. */
export type RoleSource = 'property' | 'type' | 'name' | 'none';

/** One path of a vector shape, in the layer's own coordinates (0,0 is its top-left corner). */
export interface VectorPath {
  /** How overlapping parts are filled. */
  windingRule: 'NONZERO' | 'EVENODD' | 'NONE';
  /** SVG path data, for example "M 0 0 L 10 0 L 10 10 Z". */
  data: string;
}

/** The drawn shape of a vector layer, enough to draw an icon. */
export interface LayerVector {
  /** Paths to fill with the layer's fills. */
  fill: VectorPath[];
  /** Outline of the stroke, to fill with the layer's stroke paints. Empty when the layer has no stroke. */
  stroke: VectorPath[];
}

/** The size of a layer in px. */
export interface LayerSize {
  /** Width in px. */
  width: number;
  /** Height in px. */
  height: number;
}

/** The attributes of a layer that a variant or an instance can change. Every one is optional here. */
export interface LayerAttributes {
  /** Inferred role. */
  role?: LayerRole;
  /** How the role was decided. */
  roleSource?: RoleSource;
  /** Whether the layer is visible. */
  visible?: boolean;
  /** Size in px. */
  size?: LayerSize;
  /** Position inside the parent. Written when the parent is not auto layout, or this layer is absolute in it. For children of a group, measured from the nearest ancestor that is not a group. */
  position?: LayerPosition;
  /** Rotation in degrees, counter-clockwise as Figma reports it (CSS rotates clockwise, so negate it). The size is the unrotated size. Absent means 0. */
  rotation?: number;
  /** Constraints against the parent. Written together with `position`. */
  constraints?: LayerConstraints;
  /** How this layer sits in its auto-layout parent. Only on children of an auto-layout frame. */
  placement?: LayerPlacement;
  /** Minimum and maximum size, when set. */
  sizeLimits?: SizeLimits;
  /** True when content outside the frame is clipped (CSS overflow: hidden). Only on frames, components and instances. */
  clipsContent?: boolean;
  /** True when this layer masks the layers after it in the same parent. */
  isMask?: boolean;
  /** How the layer blends with what is under it. Absent means NORMAL (or PASS_THROUGH for groups). */
  blendMode?: string;
  /** Corner smoothing (squircle) from 0 to 1. Absent means 0. */
  cornerSmoothing?: number;
  /** Layout grids on a frame. Absent when there are none. */
  layoutGrids?: LayerGrid[];
  /**
   * Variables bound to number, string or boolean fields of the layer, keyed by the Figma field name
   * (for example "paddingLeft", "itemSpacing", "topLeftRadius", "fontSize", "width"). Colour bindings
   * are on the paints. Only variables that resolve to a token in the file are listed.
   */
  bindings?: Record<string, TokenRef>;
  /** Auto-layout settings. Only on auto-layout frames. */
  layout?: LayerLayout;
  /** Corner radius in px: a number when all corners match, or per-corner values when they differ. */
  radius?: number | CornerRadii;
  /** Opacity from 0 to 1. */
  opacity?: number;
  /** Fill paints. */
  fills?: LayerPaint[];
  /** Stroke settings. */
  strokes?: LayerStrokes;
  /** Effects. Always an array, even for one shadow. */
  effects?: LayerEffect[];
  /** Text properties. Only on TEXT layers. */
  text?: LayerText;
  /** Drawn shape. Only on vector layers (VECTOR, BOOLEAN_OPERATION, STAR, POLYGON, LINE), and only when "Include vector shapes" is on. */
  vector?: LayerVector;
  /** Main component. Only on INSTANCE layers. */
  instanceOf?: InstanceOf;
  /** Component properties that drive this layer. */
  propertyRefs?: PropertyRefs;
}

/** One layer of a component's tree. Only id, name, type, visible and children are always present. */
export interface Layer extends LayerAttributes {
  /** Figma node id. */
  id: string;
  /** Layer name, for display. */
  name: string;
  /** Figma node type, for example FRAME, TEXT, INSTANCE, RECTANGLE, VECTOR, ELLIPSE or GROUP. */
  type: string;
  /** Whether the layer is visible. */
  visible: boolean;
  /** Child layers in paint order. */
  children: Layer[];
}

/** The attributes of a layer that a variant can change. Same shapes as in Layer. */
export type LayerChanges = LayerAttributes;

/** A layer that differs between a variant and the default variant. */
export interface LayerDiff {
  /** Name path from the root, for example "Button/Label". Duplicate siblings get an index, "Icon[1]". */
  path: string;
  /** Only the attributes that differ from the default variant. */
  changes: LayerChanges;
}

/** A layer that exists in a variant but not in the default variant. */
export interface AddedLayer {
  /** Name path of the parent in the default structure. */
  parentPath: string;
  /** The new layer, in full. */
  layer: Layer;
}

/** How one variant differs from the default variant. */
export interface VariantDiff {
  /** Figma node id of the variant. */
  variantId: string;
  /** The variant's property values, for example { "size": "sm" }. */
  variantProperties: Record<string, string>;
  /** Layers that differ. */
  layers: LayerDiff[];
  /** Layers present here and not in the default variant. */
  added: AddedLayer[];
  /** Name paths of layers present in the default variant and missing here. */
  removed: string[];
}

/** An instance Figma lists as a preferred value of a property. */
export interface PreferredValue {
  /** Whether the preferred value is a component or a component set. */
  type: 'COMPONENT' | 'COMPONENT_SET';
  /** Key of the component or component set. */
  key: string;
}

/** A resolved reference to a component. */
export interface ResolvedComponentRef {
  /** Figma node id. */
  id: string;
  /** Component name, for display. */
  name: string;
}

/** A component property. */
export interface ComponentPropertyV1 {
  /** The raw Figma key, for example "icon#3287:0". */
  key: string;
  /** Cleaned name, for example "icon". */
  name: string;
  /** Property type. */
  type: 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';
  /** Default value as a string. Booleans are "true" or "false". For INSTANCE_SWAP it is the node id. */
  defaultValue: string;
  /** For INSTANCE_SWAP, the default component. Absent for other types or when it cannot be resolved. */
  defaultResolved?: ResolvedComponentRef;
  /** For VARIANT properties, the allowed values. */
  variantOptions?: string[];
  /** For INSTANCE_SWAP, the preferred instances. */
  preferredValues?: PreferredValue[];
}

/** One variant of a component set. */
export interface ComponentVariantV1 {
  /** Figma node id. */
  id: string;
  /** Variant name, for example "size=sm, state=hover". */
  name: string;
  /** Property values of the variant. */
  variantProperties: Record<string, string>;
  /** Description of the variant. */
  description: string;
}

/** Geometry of the default variant. */
export interface ComponentLayoutV1 {
  /** Name of the variant the measurements came from. */
  measuredFrom: string;
  /** Width in px. */
  width: number;
  /** Height in px. */
  height: number;
  /** Layout mode of the root. */
  layoutMode: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  /** Space between children in px. Auto-layout only. */
  gap?: number;
  /** Padding in px. Auto-layout only. */
  padding?: Padding;
  /** Uniform corner radius in px. Omitted when corners differ or the radius is 0. */
  cornerRadius?: number;
}

/** One component or component set. */
export interface ComponentV1 {
  /** Figma node id. */
  id: string;
  /** Figma component key, empty for unpublished components. */
  key: string;
  /** Component name, for example "Button / primary". */
  name: string;
  /** Description from Figma. Text for people. */
  description: string;
  /** True for a component set (has variants). */
  isComponentSet: boolean;
  /** Name of the page the component is on. */
  pageName: string;
  /** Variants. One entry for a plain component. */
  variants: ComponentVariantV1[];
  /** Component properties. */
  properties: ComponentPropertyV1[];
  /** State values found in the variants, for example "hover". */
  states: string[];
  /** Size values found in the variants, for example "sm". */
  sizes: string[];
  /** Names of related components. */
  relatedComponentNames: string[];
  /** Ids of the variables used anywhere in the component. Keys of the `tokens` lookup. */
  boundVariableIds: string[];
  /** Ids of the styles used anywhere in the component. Keys of the `tokens` lookup. */
  styleIds: string[];
  /** Geometry of the default variant. */
  layout?: ComponentLayoutV1;
  /** Id of the variant the `tree` was read from. */
  defaultVariantId: string;
  /** Layer tree of the default variant. */
  tree: Layer;
  /** Differences of every other variant from the default. Empty when diffs are off or skipped. */
  variantDiffs: VariantDiff[];
  /** True when the layer, depth, time or memory budget was hit, so `tree` is incomplete. */
  treeTruncated: boolean;
}

/** Stable codes for warnings. New codes may be added within v1, so handle unknown codes. */
export type WarningCode =
  | 'TREE_TRUNCATED'
  | 'COMPONENT_FAILED'
  | 'DUPLICATE_SIBLING_NAME'
  | 'VARIANT_DIFFS_SKIPPED'
  | 'UNRESOLVED_REFERENCE'
  | 'PROPERTIES_UNREADABLE'
  | 'SCAN_CANCELLED'
  | 'TIME_BUDGET_EXCEEDED'
  | 'OUTPUT_TOO_LARGE'
  | 'OUTPUT_SPLIT'
  | 'IMAGE_OMITTED'
  | 'VECTOR_OMITTED';

/** A non-fatal issue found while generating the file. */
export interface ComponentsWarning {
  /** Stable code. Match on this, not on the message. */
  code: WarningCode;
  /** Text for people. Do not parse. */
  message: string;
  /** Id of the component the warning is about. */
  componentId?: string;
  /** Id of the layer the warning is about. */
  layerId?: string;
}

/** The export options the file was made with, so an empty list can be told from a switched-off option. */
export interface ComponentsOptionsUsed {
  /** True when text content (layer characters) is included. When false, `text.characters` is absent everywhere. */
  includeText: boolean;
  /** True when variant differences were read. When false, every `variantDiffs` is empty because nothing was compared, not because variants are identical. */
  includeVariantDiffs: boolean;
  /** True when the layers inside nested instances were read. When false, an instance layer has no children: its insides are in the component it points at (`instanceOf`). */
  includeInstanceInternals: boolean;
  /** True when the drawn shape of vector layers is included (`vector`). Absent in files from before this option existed, which have none. */
  includeVectorShapes?: boolean;
  /** True when the pictures behind image fills were exported as files (`image.file`). Absent in files from before this option existed. */
  includeImages?: boolean;
}

/** Details about the file the output was made from. */
export interface ComponentsMetadata {
  /** Name of the Figma file. */
  fileName: string;
  /** Figma file key. Absent when Figma does not provide one. */
  fileKey?: string;
  /** What was scanned: the whole file or the selection. */
  scope: 'file' | 'selection';
  /** When the file was generated, ISO 8601. The only timestamp in the file. */
  generatedAt: string;
  /** Version of the DesignMD plugin that wrote the file. */
  pluginVersion: string;
  /** The options this file was made with. */
  options: ComponentsOptionsUsed;
  /** SHA-256 of the file with generatedAt and contentHash set to "". Use it to detect changes. */
  contentHash: string;
}

/** One line of the index. */
export interface ComponentIndexEntry {
  /** Figma node id of the component. */
  id: string;
  /** Component name. */
  name: string;
  /** Path of the file holding this component, for example "components/Button.json". Present only when the output is split. */
  file?: string;
  /** SHA-256 content hash of the file in `file`, so a change inside any component is visible from the index. Present only when the output is split. */
  contentHash?: string;
}

/** Counts and names, so a tool can decide what to read. */
export interface ComponentsIndex {
  /** Number of components in the scan, including those stored in separate files. */
  componentCount: number;
  /** One entry per component, in the same order as the components. */
  components: ComponentIndexEntry[];
}

/** The root of components.json. */
export interface ComponentsFileV1 {
  /** URL of the JSON Schema for this file. */
  $schema: string;
  /** Format identifier and version. Always "designmd.components/v1". */
  schema: 'designmd.components/v1';
  /** Details about the file. */
  metadata: ComponentsMetadata;
  /** Counts and names. */
  index: ComponentsIndex;
  /** Only the variables and styles the components use, keyed by Figma id, with default-mode values. */
  tokens: Record<string, TokenEntry>;
  /** The components. Empty in the main file when the output is split into components/<name>.json files. */
  components: ComponentV1[];
  /** Non-fatal issues. */
  warnings: ComponentsWarning[];
}
