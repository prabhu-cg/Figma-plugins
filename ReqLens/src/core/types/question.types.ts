import type { ComponentCategory, DetectedComponent, FrameAnalysis } from './analysis.types';

export type QuestionGroup = 'business' | 'functional' | 'non-functional' | 'security' | 'accessibility';

export type QuestionPriority = 'high' | 'medium' | 'low';

export interface GeneratedQuestion {
  /** Stable id: `${ruleId}:${componentIds.join('+')}` */
  id: string;
  ruleId: string;
  ruleDescription: string;
  text: string;
  group: QuestionGroup;
  priority: QuestionPriority;
  /** The component category this question is about, 'composite' for multi-component rules, or 'custom' for user-added questions. */
  category: ComponentCategory | 'composite' | 'custom';
  componentIds: string[];
  frameId: string;
  frameName: string;
}

/** Fires once per detected component of a given category. */
export interface SingleComponentRule {
  kind: 'single';
  id: string;
  description: string;
  appliesTo: ComponentCategory;
  group: QuestionGroup;
  priority: QuestionPriority;
  /** Optional extra guard beyond category matching, e.g. only instances with a variant. */
  when?: (component: DetectedComponent) => boolean;
  questions: (component: DetectedComponent) => string[];
}

/**
 * Fires once per frame when a cross-component pattern is present (e.g. table + search +
 * an "export" button). `matches` returns the components that satisfied the pattern (used
 * to link the resulting question back to its evidence), or null when the rule doesn't apply.
 */
export interface CompositeRule {
  kind: 'composite';
  id: string;
  description: string;
  group: QuestionGroup;
  priority: QuestionPriority;
  matches: (frame: FrameAnalysis) => DetectedComponent[] | null;
  questions: (frame: FrameAnalysis, matched: DetectedComponent[]) => string[];
}

export type QuestionRule = SingleComponentRule | CompositeRule;
