/// <reference types="@figma/plugin-typings" />

// Raw shapes extracted directly from the Figma API — no inference applied.
// These types mirror the Figma API as closely as possible.

export interface RawColorStyle {
  id: string;
  name: string;
  paints: readonly Paint[];
}

export interface RawTextStyle {
  id: string;
  name: string;
  fontName: FontName;
  fontSize: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textDecoration: TextDecoration;
}

export interface RawEffectStyle {
  id: string;
  name: string;
  effects: readonly Effect[];
}

export interface RawGridStyle {
  id: string;
  name: string;
  grids: readonly LayoutGrid[];
}

export interface RawVariable {
  id: string;
  name: string;
  collectionId: string;
  collectionName: string;
  resolvedType: VariableResolvedDataType;
  valuesByMode: Record<string, unknown>;
  aliasedVariableId: string | null;
}

export interface RawComponentNode {
  id: string;
  name: string;
  description?: string;
  componentPropertyDefinitions?: ComponentPropertyDefinitions;
  children?: readonly any[];
  fills?: readonly Paint[];
  strokes?: readonly Paint[];
  effects?: readonly Effect[];
  fillStyleId?: string;
  strokeStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
  boundVariables?: Record<string, unknown>;
}

export interface RawVariantNode {
  id: string;
  name: string;
  componentProperties?: ComponentProperties;
  children?: readonly any[];
  fills?: readonly Paint[];
  strokes?: readonly Paint[];
  effects?: readonly Effect[];
  fillStyleId?: string;
  textStyleId?: string;
  effectStyleId?: string;
}

export interface RawInstanceNode {
  id: string;
  name: string;
  type: 'INSTANCE';
  componentKey?: string;
  mainComponent?: RawComponentNode;
  componentProperties?: ComponentProperties;
  children?: readonly RawNode[];
  fills?: readonly Paint[];
  strokes?: readonly Paint[];
  effects?: readonly Effect[];
}

export type RawNode =
  | RawComponentNode
  | RawVariantNode
  | RawInstanceNode
  | SceneNode;

export interface RawExtractionResult {
  colorStyles: RawColorStyle[];
  textStyles: RawTextStyle[];
  effectStyles: RawEffectStyle[];
  gridStyles: RawGridStyle[];
  colorVariables: RawVariable[];
  typographyVariables: RawVariable[];
  spacingVariables: RawVariable[];
  components: RawComponentNode[];
  variantsByComponentId: Record<string, RawVariantNode[]>;
  selectedNodeIds: string[];
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
}
