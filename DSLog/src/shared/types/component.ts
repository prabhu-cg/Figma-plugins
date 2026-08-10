export type ComponentPropertyType =
  | "VARIANT"
  | "BOOLEAN"
  | "TEXT"
  | "INSTANCE_SWAP"
  | "SLOT";

export interface ComponentPropertySnapshot {
  name: string;
  type: ComponentPropertyType;
  defaultValue: string | boolean | null;
  variantOptions?: string[];
  preferredValues?: Array<{ type: string; key: string }>;
  description?: string;
  boundVariableId?: string;
}

export interface VariantSnapshot {
  name: string;
  properties: Record<string, string>;
}

export interface StyleBindingSnapshot {
  field: string;
  styleId: string;
  styleName?: string;
  styleType: "PAINT" | "TEXT" | "EFFECT" | "GRID";
}

export interface TokenBindingSnapshot {
  field: string;
  variableId: string;
  variableName?: string;
}

export interface LayoutSnapshot {
  mode?: "NONE" | "HORIZONTAL" | "VERTICAL" | "GRID";
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  primaryAxisAlign?: string;
  counterAxisAlign?: string;
  primaryAxisSizing?: string;
  counterAxisSizing?: string;
}

export interface PaintSnapshot {
  type: string;
  color?: string;
  opacity?: number;
  visible?: boolean;
  boundVariableId?: string;
}

export interface EffectSnapshot {
  type: string;
  visible?: boolean;
  radius?: number;
  color?: string;
  offsetX?: number;
  offsetY?: number;
}

export interface TypographySnapshot {
  fontFamily?: string;
  fontStyle?: string;
  fontSize?: number;
  lineHeight?: string;
  letterSpacing?: string;
  boundVariableIds?: Record<string, string>;
}

export interface NodeStructureSnapshot {
  /** Stable path-based key (index within parent + name) rather than volatile node id. */
  key: string;
  name: string;
  type: string;
  visible: boolean;
  width?: number;
  height?: number;
  cornerRadius?: number;
  fills?: PaintSnapshot[];
  strokes?: PaintSnapshot[];
  effects?: EffectSnapshot[];
  layout?: LayoutSnapshot;
  typography?: TypographySnapshot;
  tokenBindings?: TokenBindingSnapshot[];
  styleBindings?: StyleBindingSnapshot[];
  children: NodeStructureSnapshot[];
}

export interface ComponentSnapshot {
  identity: {
    id: string;
    key?: string;
    name: string;
    componentSetId?: string;
    componentSetName?: string;
    remote: boolean;
  };

  metadata: {
    description?: string;
    documentationLink?: string;
  };

  properties: ComponentPropertySnapshot[];

  variants: VariantSnapshot[];

  structure: NodeStructureSnapshot;

  tokens: TokenBindingSnapshot[];

  styles: StyleBindingSnapshot[];

  dimensions: {
    width?: number;
    height?: number;
  };

  layout?: LayoutSnapshot;

  /** Deterministic content hash, used to short-circuit unchanged components. */
  hash: string;

  capturedAt: string;
}
