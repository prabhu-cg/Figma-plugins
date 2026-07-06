/**
 * Normalized Design System schema.
 *
 * This is the single source of truth that every generator reads from.
 * Nothing downstream (design.md, component docs, tokens.json, css-tokens.json)
 * is ever produced directly from raw Figma nodes — everything is derived
 * from this schema so outputs stay consistent and independently testable.
 */

export type TokenCategory =
  | 'color'
  | 'typography'
  | 'spacing'
  | 'effect'
  | 'grid'
  | 'boolean'
  | 'string'
  | 'number'
  | 'semantic'
  | 'component'
  | 'other';

export type VariableResolvedType = 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';

export interface ColorValue {
  hex: string;
  r: number;
  g: number;
  b: number;
  a: number;
}

export type TokenValue =
  | { kind: 'color'; color: ColorValue }
  | { kind: 'float'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'alias'; variableId: string; variableName: string }
  | { kind: 'unknown' };

export interface TokenValueByMode {
  modeId: string;
  modeName: string;
  value: TokenValue;
}

export interface VariableMode {
  modeId: string;
  name: string;
}

export interface VariableCollection {
  id: string;
  name: string;
  modes: VariableMode[];
  defaultModeId: string;
  variableIds: string[];
  hiddenFromPublishing: boolean;
}

export interface VariableToken {
  id: string;
  name: string;
  /** name.split('/') — used to build nested token trees */
  path: string[];
  collectionId: string;
  collectionName: string;
  resolvedType: VariableResolvedType;
  category: TokenCategory;
  description: string;
  scopes: string[];
  valuesByMode: TokenValueByMode[];
  codeSyntax: Partial<Record<'WEB' | 'ANDROID' | 'iOS', string>>;
  /** e.g. --color-primary-500 */
  cssName: string;
}

export interface TextStyleProperties {
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: string;
  letterSpacing: string;
  textCase: string;
  textDecoration: string;
  paragraphSpacing: number;
}

export interface EffectValue {
  type: string;
  color?: ColorValue;
  offsetX?: number;
  offsetY?: number;
  radius?: number;
  spread?: number;
  visible: boolean;
}

export interface GridValue {
  pattern: string;
  sectionSize?: number;
  count?: number;
  gutterSize?: number;
  offset?: number;
  alignment?: string;
}

export type StyleKind = 'TEXT' | 'PAINT' | 'EFFECT' | 'GRID';

export interface StyleToken {
  id: string;
  name: string;
  path: string[];
  type: StyleKind;
  description: string;
  cssName: string;
  textProperties?: TextStyleProperties;
  paint?: ColorValue;
  paintIsGradientOrImage?: boolean;
  effects?: EffectValue[];
  grids?: GridValue[];
}

export type ComponentPropertyType = 'BOOLEAN' | 'TEXT' | 'INSTANCE_SWAP' | 'VARIANT';

export interface ComponentProperty {
  name: string;
  type: ComponentPropertyType;
  defaultValue: string;
  variantOptions?: string[];
}

export interface ComponentVariant {
  id: string;
  name: string;
  variantProperties: Record<string, string>;
  description: string;
}

export interface ComponentDoc {
  id: string;
  key: string;
  name: string;
  description: string;
  isComponentSet: boolean;
  variants: ComponentVariant[];
  properties: ComponentProperty[];
  states: string[];
  sizes: string[];
  boundVariableIds: string[];
  relatedComponentNames: string[];
  pageName: string;
}

export interface DesignSystemSummary {
  variableCollectionsCount: number;
  variablesCount: number;
  componentsCount: number;
  componentSetsCount: number;
  textStylesCount: number;
  colorStylesCount: number;
  effectStylesCount: number;
  gridStylesCount: number;
  modesCount: number;
}

export interface DesignSystemMetadata {
  fileName: string;
  generatedAt: string;
  pluginVersion: string;
}

export interface DesignSystem {
  metadata: DesignSystemMetadata;
  collections: VariableCollection[];
  variables: VariableToken[];
  styles: {
    text: StyleToken[];
    color: StyleToken[];
    effect: StyleToken[];
    grid: StyleToken[];
  };
  components: ComponentDoc[];
  summary: DesignSystemSummary;
  /** Actionable, non-fatal issues surfaced during extraction/transformation. */
  warnings: string[];
}
