/**
 * Minimal, duck-typed shapes describing exactly the fields DSLog reads off
 * real Figma nodes/variables. Keeping normalization functions pure and
 * dependent on these narrow shapes (instead of the full Figma API types)
 * means they can run against plain fixture objects in unit tests, with no
 * `figma` global required.
 */

export interface PaintLike {
  type: string;
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number };
  boundVariables?: { color?: { id: string } };
}

export interface EffectLike {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: { r: number; g: number; b: number; a?: number };
  offset?: { x: number; y: number };
}

export interface BoundVariablesLike {
  [field: string]: { id: string } | Array<{ id: string }> | undefined;
}

export interface NodeLike {
  id: string;
  name: string;
  type: string;
  visible?: boolean;
  width?: number;
  height?: number;
  cornerRadius?: number | symbol;
  fills?: PaintLike[] | symbol;
  strokes?: PaintLike[];
  effects?: EffectLike[];
  layoutMode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  primaryAxisAlignItems?: string;
  counterAxisAlignItems?: string;
  primaryAxisSizingMode?: string;
  counterAxisSizingMode?: string;
  fontName?: { family: string; style: string } | symbol;
  fontSize?: number | symbol;
  lineHeight?: { value: number; unit: string } | { unit: "AUTO" } | symbol;
  letterSpacing?: { value: number; unit: string } | symbol;
  fillStyleId?: string | symbol;
  strokeStyleId?: string | symbol;
  effectStyleId?: string | symbol;
  textStyleId?: string | symbol;
  boundVariables?: BoundVariablesLike;
  children?: NodeLike[];
}

export interface ComponentPropertyDefinitionLike {
  type: "VARIANT" | "BOOLEAN" | "TEXT" | "INSTANCE_SWAP" | "SLOT";
  defaultValue?: string | boolean;
  variantOptions?: string[];
  preferredValues?: Array<{ type: string; key: string }>;
  boundVariables?: { id: string };
}

export interface ComponentVariantLike {
  id: string;
  name: string;
  variantProperties?: Record<string, string> | null;
  node: NodeLike;
}

export interface ComponentInputLike {
  id: string;
  key?: string;
  name: string;
  type: "COMPONENT" | "COMPONENT_SET";
  description?: string;
  documentationLinks?: Array<{ uri: string }>;
  remote: boolean;
  componentSetId?: string;
  componentSetName?: string;
  componentPropertyDefinitions?: Record<string, ComponentPropertyDefinitionLike>;
  variants: ComponentVariantLike[];
  /** Representative node used for structural diffing (main variant, or the component itself). */
  representative: NodeLike;
}

export interface VariableAliasLike {
  type: "VARIABLE_ALIAS";
  id: string;
}

export interface RgbaLike {
  r: number;
  g: number;
  b: number;
  a?: number;
}

export interface VariableModeValueLike {
  modeId: string;
  modeName: string;
  value: string | number | boolean | VariableAliasLike | RgbaLike | null;
}

export interface VariableInputLike {
  id: string;
  key?: string;
  name: string;
  collectionId: string;
  collectionName: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  scopes: string[];
  description?: string;
  remote: boolean;
  libraryKey?: string;
  valuesByMode: VariableModeValueLike[];
  variableNamesById?: Record<string, string>;
}

export interface CollectionInputLike {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  remote: boolean;
}
