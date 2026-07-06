/**
 * Intermediate, plain-serializable shapes mirroring the Figma Plugin API.
 * Extraction converts live Figma API objects into these; the transform layer
 * turns them into the normalized DesignSystem schema. Keeping this seam
 * means transform functions are pure and unit-testable without a Figma runtime.
 */

export interface RawVariableMode {
  modeId: string;
  name: string;
}

export interface RawVariableCollection {
  id: string;
  name: string;
  modes: RawVariableMode[];
  defaultModeId: string;
  variableIds: string[];
  hiddenFromPublishing: boolean;
}

export type RawVariableValue =
  | { kind: 'color'; r: number; g: number; b: number; a: number }
  | { kind: 'float'; value: number }
  | { kind: 'string'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'alias'; variableId: string }
  | { kind: 'unknown' };

export interface RawVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: string;
  description: string;
  scopes: string[];
  codeSyntax: Partial<Record<'WEB' | 'ANDROID' | 'iOS', string>>;
  valuesByMode: { modeId: string; value: RawVariableValue }[];
}

export interface RawTextStyle {
  id: string;
  name: string;
  description: string;
  fontFamily: string;
  fontStyle: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: string;
  letterSpacing: string;
  textCase: string;
  textDecoration: string;
  paragraphSpacing: number;
  boundVariableIds: string[];
}

export interface RawPaintStyle {
  id: string;
  name: string;
  description: string;
  color: { r: number; g: number; b: number; a: number } | null;
  isGradientOrImage: boolean;
  boundVariableIds: string[];
}

export interface RawEffect {
  type: string;
  color?: { r: number; g: number; b: number; a: number };
  offsetX?: number;
  offsetY?: number;
  radius?: number;
  spread?: number;
  visible: boolean;
}

export interface RawEffectStyle {
  id: string;
  name: string;
  description: string;
  effects: RawEffect[];
  boundVariableIds: string[];
}

export interface RawGrid {
  pattern: string;
  sectionSize?: number;
  count?: number;
  gutterSize?: number;
  offset?: number;
  alignment?: string;
}

export interface RawGridStyle {
  id: string;
  name: string;
  description: string;
  grids: RawGrid[];
}

export interface RawComponentProperty {
  name: string;
  type: string;
  defaultValue: string;
  variantOptions?: string[];
}

export interface RawComponentVariant {
  id: string;
  name: string;
  description: string;
  variantProperties: Record<string, string>;
  boundVariableIds: string[];
}

export interface RawComponent {
  id: string;
  key: string;
  name: string;
  description: string;
  isComponentSet: boolean;
  pageName: string;
  properties: RawComponentProperty[];
  variants: RawComponentVariant[];
  boundVariableIds: string[];
}

export interface ExtractionResult {
  collections: RawVariableCollection[];
  variables: RawVariable[];
  textStyles: RawTextStyle[];
  paintStyles: RawPaintStyle[];
  effectStyles: RawEffectStyle[];
  gridStyles: RawGridStyle[];
  components: RawComponent[];
  warnings: string[];
}
