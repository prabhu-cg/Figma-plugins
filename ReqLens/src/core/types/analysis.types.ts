export type ComponentCategory =
  | 'button'
  | 'input'
  | 'dropdown'
  | 'search'
  | 'table'
  | 'card'
  | 'modal'
  | 'navigation'
  | 'chart'
  | 'tabs'
  | 'accordion';

export const ALL_COMPONENT_CATEGORIES: readonly ComponentCategory[] = [
  'button',
  'input',
  'dropdown',
  'search',
  'table',
  'card',
  'modal',
  'navigation',
  'chart',
  'tabs',
  'accordion',
];

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'unknown';

export interface DetectedComponent {
  /** Stable id: `${frameId}:${nodeId}:${category}` */
  id: string;
  category: ComponentCategory;
  nodeId: string;
  nodeName: string;
  frameId: string;
  frameName: string;
  /** Visible text label extracted from the node subtree, if any. */
  label?: string;
  /** e.g. button variant, chart type, navigation style. */
  variant?: string;
  /** 0-1 heuristic confidence score. */
  confidence: number;
  /** Human-readable reasons the analyzer flagged this node, shown in the UI for transparency. */
  evidence: string[];
  metadata?: Record<string, string | number | boolean>;
}

export interface FrameAnalysis {
  frameId: string;
  frameName: string;
  nodeCount: number;
  truncated: boolean;
  components: DetectedComponent[];
  analyzedAt: number;
  durationMs: number;
}

export type ComponentCategoryCounts = Record<ComponentCategory, number>;

export interface AnalysisResult {
  frames: FrameAnalysis[];
  totalComponents: number;
  componentsByCategory: ComponentCategoryCounts;
  multiFrame: boolean;
}

export function emptyCategoryCounts(): ComponentCategoryCounts {
  return ALL_COMPONENT_CATEGORIES.reduce((acc, category) => {
    acc[category] = 0;
    return acc;
  }, {} as ComponentCategoryCounts);
}
