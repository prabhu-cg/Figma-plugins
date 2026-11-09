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
  /** Token type. */
  type: 'color';
  /** The resolved default-mode value. */
  value: ColorRgba;
}

/** A numeric token, resolved for the default mode. */
export interface NumberTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** "dimension" is a length in px; "number" is unitless. */
  type: 'dimension' | 'number';
  /** The resolved default-mode value. */
  value: number;
}

/** A string token, resolved for the default mode. */
export interface StringTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** Token type. */
  type: 'string' | 'fontFamily';
  /** The resolved default-mode value. */
  value: string;
}

/** A boolean token, resolved for the default mode. */
export interface BooleanTokenEntry {
  /** CSS custom property name. */
  cssName: string;
  /** Token type. */
  type: 'boolean';
  /** The resolved default-mode value. */
  value: boolean;
}

/** A style token (text, effect, gradient) as flat key-value pairs. Full detail is in tokens.json. */
export interface CompositeTokenEntry {
  /** CSS custom property name. */
  cssName: string;
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
}

/** A fill or stroke paint. Image bytes are never exported. */
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
  /** Opacity from 0 to 1, for SOLID paints. */
  alpha?: number;
  /** Short human-readable description of a gradient or image paint. */
  description?: string;
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
  /** Font family name. */
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
  /** The color token bound to the text fill, when there is one. */
  token?: TokenRef;
}

/** A stretch of text with its own style, used when a text layer mixes styles. */
export interface TextRun extends TextStyleFields {
  /** The characters of this run. */
  characters: string;
}

/** Text properties of a TEXT layer. */
export interface LayerText extends TextStyleFields {
  /** The text content. Absent when "Include text content" is off. */
  characters?: string;
  /** Horizontal alignment. */
  align: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  /** True when the layer mixes styles. The fields above then describe the first run. */
  mixed?: boolean;
  /** One entry per style run, written when `mixed` is true. */
  runs?: TextRun[];
}

/** The main component an instance layer points at. */
export interface InstanceOf {
  /** Id of the main component. */
  componentId: string;
  /** Name of the main component, for display. */
  componentName: string;
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

/** The size of a layer in px. */
export interface LayerSize {
  /** Width in px. */
  width: number;
  /** Height in px. */
  height: number;
}

/** One layer of a component's tree. Only id, name, type, visible and children are always present. */
export interface Layer {
  /** Figma node id. */
  id: string;
  /** Layer name, for display. */
  name: string;
  /** Figma node type, for example FRAME, TEXT, INSTANCE, RECTANGLE, VECTOR, ELLIPSE or GROUP. */
  type: string;
  /** Inferred role. */
  role?: LayerRole;
  /** How the role was decided. */
  roleSource?: RoleSource;
  /** Whether the layer is visible. */
  visible: boolean;
  /** Size in px. */
  size?: LayerSize;
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
  /** Main component. Only on INSTANCE layers. */
  instanceOf?: InstanceOf;
  /** Component properties that drive this layer. */
  propertyRefs?: PropertyRefs;
  /** Child layers in paint order. */
  children: Layer[];
}

/** The attributes of a layer that a variant can change. Same shapes as in Layer. */
export type LayerChanges = Partial<Omit<Layer, 'id' | 'name' | 'type' | 'children'>>;

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
  | 'SCAN_CANCELLED'
  | 'OUTPUT_TOO_LARGE';

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
