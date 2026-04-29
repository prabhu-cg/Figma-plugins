// ─── Source ───────────────────────────────────────────────────────────────────

export interface SourceInfo {
  fileKey: string;
  fileName: string;
  pageId: string;
  pageName: string;
  selectionIds: string[];
}

// ─── Root Manifest ────────────────────────────────────────────────────────────

export interface RootManifest {
  version: string;
  generatedAt: string;
  source: SourceInfo;
  domains: {
    foundations: FoundationsSchema;
    components: ComponentsSchema;
    metadata: MetadataSchema;
    health: HealthSchema;
  };
}

// ─── Foundations ──────────────────────────────────────────────────────────────

export type SemanticColorRole =
  | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  | 'neutral' | 'surface' | 'on-surface' | 'unknown';

export type TokenSource = 'style' | 'variable';

export interface RgbValue {
  r: number;
  g: number;
  b: number;
}

export interface ColorToken {
  id: string;
  tokenName: string;
  label: string;
  value: { hex: string; rgb: RgbValue };
  semanticRole: SemanticColorRole;
  source: TokenSource;
  variableMode: string | null;
  aliases: string[];
  contrastOnWhite: number;
  contrastOnBlack: number;
  wcagAA: boolean;
  wcagAAA: boolean;
  usageHint: string;
}

export type TypographyRole =
  | 'display' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
  | 'body-lg' | 'body-md' | 'body-sm'
  | 'caption' | 'label' | 'code' | 'overline' | 'unknown';

export type LineHeightUnit = 'px' | '%' | 'auto';
export type LetterSpacingUnit = 'px' | '%';
export type TextCaseValue = 'none' | 'uppercase' | 'lowercase' | 'capitalize';
export type TextDecorationValue = 'none' | 'underline' | 'strikethrough';

export interface TypographyToken {
  id: string;
  tokenName: string;
  label: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeight: { value: number; unit: LineHeightUnit };
  letterSpacing: { value: number; unit: LetterSpacingUnit };
  textCase: TextCaseValue;
  textDecoration: TextDecorationValue;
  role: TypographyRole;
  source: TokenSource;
  usageHint: string;
}

export interface SpacingToken {
  tokenName: string;
  label: string;
  value: number;
  unit: 'px';
  scaleBase: number;
  scaleStep: number;
  usageHint: string;
}

export type BreakpointHint = 'mobile' | 'tablet' | 'desktop' | 'wide' | 'unknown';
export type GridType = 'columns' | 'rows' | 'grid';

export interface GridToken {
  tokenName: string;
  label: string;
  type: GridType;
  count: number;
  gutter: number;
  margin: number;
  sectionSize: number;
  breakpointHint: BreakpointHint;
}

export interface FoundationsSchema {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  grids: GridToken[];
}

// ─── Components ───────────────────────────────────────────────────────────────

export type ComponentCategory = 'atom' | 'molecule' | 'organism' | 'template' | 'unknown';
export type AnatomyRole = 'text' | 'icon' | 'container' | 'indicator' | 'media' | 'unknown';
export type VariantGroupType = 'variant' | 'state';
export type AccessibilityRole = 'button' | 'link' | 'input' | 'checkbox' | 'radio' | 'listitem' | 'unknown';

export interface AnatomyPart {
  partName: string;
  nodeId: string;
  role: AnatomyRole;
}

export interface VariantGroup {
  property: string;
  type: VariantGroupType;
  values: string[];
}

export interface ComponentVariant {
  id: string;
  combination: Record<string, string>;
  nodeId: string;
}

export interface TokenBindings {
  colors: string[];
  typography: string[];
  spacing: string[];
  effects: string[];
}

export interface AccessibilityNotes {
  role: AccessibilityRole;
  keyboardInteraction: string;
  ariaAttributes: string[];
}

export interface UsageGuidelines {
  when: string[];
  whenNot: string[];
  antiPatterns: string[];
}

export interface ComponentDoc {
  id: string;
  name: string;
  description: string;
  category: ComponentCategory;
  anatomy: AnatomyPart[];
  variantGroups: VariantGroup[];
  variants: ComponentVariant[];
  states: string[];
  tokenBindings: TokenBindings;
  accessibilityNotes: AccessibilityNotes;
  usageGuidelines: UsageGuidelines;
  doExamples: Array<{ label: string; description: string }>;
  dontExamples: Array<{ label: string; description: string }>;
}

export interface ComponentsSchema {
  components: ComponentDoc[];
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export interface MetadataCounts {
  colorTokens: number;
  typographyTokens: number;
  spacingTokens: number;
  gridTokens: number;
  components: number;
  variants: number;
  tokenBindings: number;
}

export interface MetadataSchema {
  pluginVersion: string;
  schemaVersion: string;
  generatedAt: string;
  source: Pick<SourceInfo, 'fileKey' | 'fileName' | 'selectionIds'>;
  counts: MetadataCounts;
  exportFormats: string[];
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type WarningSeverity = 'error' | 'warning' | 'info';
export type HealthDomain = 'foundations' | 'components' | 'metadata';
export type WarningCode =
  | 'MISSING_DESCRIPTION' | 'UNLINKED_TOKEN' | 'INCONSISTENT_NAMING'
  | 'NO_STATES' | 'NO_VARIANTS' | 'HARDCODED_VALUE';

export interface HealthWarning {
  severity: WarningSeverity;
  domain: HealthDomain;
  itemId: string;
  itemName: string;
  code: WarningCode;
  message: string;
  suggestion: string;
}

export interface MissingField {
  domain: string;
  itemId: string;
  field: string;
}

export interface HealthBreakdown {
  foundationsScore: number;
  componentsScore: number;
  tokenCoverageScore: number;
  namingConsistencyScore: number;
}

export interface NamingPatterns {
  detected: string[];
  consistent: boolean;
  recommendation: string;
}

export interface HealthSchema {
  overallScore: number;
  breakdown: HealthBreakdown;
  warnings: HealthWarning[];
  missingFields: MissingField[];
  namingPatterns: NamingPatterns;
}
