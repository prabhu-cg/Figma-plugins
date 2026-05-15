// ─── Component Documentation Types ────────────────────────────────────────────

export interface ComponentProperty {
  name: string;
  values: string[];
}

export interface AnatomyPart {
  name: string;
  description: string;
  nodeId?: string;
  nodeType?: string;
}

export interface VariantGroup {
  name: string;
  values: string[];
}

export interface ComponentState {
  name: string;
  description: string;
}

export interface TokenBinding {
  element: string;
  value: string;
  isToken: boolean; // true if bound to Figma variable, false if inferred
}

export interface AccessibilityInfo {
  contrast?: string;
  interactionClarity: string;
}

export interface DesignSpec {
  name: string;
  value: string;
}

export interface LayoutProperties {
  autoLayout?: {
    enabled: boolean;
    direction?: 'HORIZONTAL' | 'VERTICAL';
    spacing?: number;
    padding?: { top: number; right: number; bottom: number; left: number };
    alignment?: string;
    justifyContent?: string;
  };
  dimensions?: {
    width?: number;
    height?: number;
  };
  constraints?: {
    horizontal?: string;
    vertical?: string;
  };
  fills?: Array<{
    type: string;
    color: string;
    opacity?: number;
  }>;
  strokes?: Array<{
    type: string;
    color: string;
    width?: number;
    opacity?: number;
    align?: string;
  }>;
  borderRadius?: number;
  individualRadius?: {
    topLeft?: number;
    topRight?: number;
    bottomLeft?: number;
    bottomRight?: number;
  };
  effects?: Array<{
    type: string;
    blurRadius?: number;
    offsetX?: number;
    offsetY?: number;
    color?: string;
  }>;
  opacity?: number;
  blendMode?: string;
}

export interface UsageGuidelines {
  whenToUse: string[];
  whenNotToUse: string[];
  dos: string[];
  donts: string[];
}

export interface AssumptionNote {
  category: string;
  description: string;
}

export interface ComponentAPIProperty {
  property: string;   // e.g. "size"
  type: string;       // "enum" | "boolean" | "string"
  values: string;     // e.g. "small, medium, large"
  required: string;   // "Yes" | "No"
}

export interface InteractionBehavior {
  behavior: string;    // e.g. "Clickable", "Selectable", "Expandable"
  description: string; // e.g. "Triggers primary action"
}

export interface ComponentDocumentation {
  name: string;
  description: string;
  pageName?: string;
  category?: string;  // Component category (atom, molecule, organism, etc.)
  anatomy: AnatomyPart[];
  variantGroups: VariantGroup[];
  variantCombinations?: string[];             // All possible variant combinations
  states: ComponentState[];
  properties: ComponentProperty[];
  tokenBindings: {
    colors: TokenBinding[];
    spacing: TokenBinding[];
    typography: TokenBinding[];
  };
  layoutProperties: LayoutProperties;
  accessibility: AccessibilityInfo;
  usage: UsageGuidelines;
  assumptions: AssumptionNote[];
  intent?: string;                            // Semantic purpose of component
  interactionBehaviors?: InteractionBehavior[]; // Evidence-based interactions
  responsiveBehavior?: string[];              // Responsive behavior from layout
  uxRules?: string[];                         // UX governance rules
  accessibilityObservations?: string[];       // Evidence-based observations (not claims)
  componentAPI?: ComponentAPIProperty[];      // Derived from variants + properties
}

export interface DocumentationResult {
  valid: boolean;
  error?: string;
  components?: ComponentDocumentation[];
  markdown?: string;
  ui?: {
    components: Array<{
      name: string;
      variantChips: string[];
      variantCount: number;
    }>;
  };
}

export interface ExtractionContext {
  components: any[];
  variantsByComponentId: Record<string, any[]>;
  colorVariables?: any[];
  spacingVariables?: any[];
  textStyles?: any[];
  variableIdToNameMap?: Record<string, string>;
  componentIdToPageName?: Record<string, string>;
}
