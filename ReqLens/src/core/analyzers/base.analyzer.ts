import type { AnalyzableNode } from '@core/types/figma-node.types';
import type { ComponentCategory, DetectedComponent } from '@core/types/analysis.types';

export interface AnalyzerContext {
  frameId: string;
  frameName: string;
}

export interface Analyzer {
  category: ComponentCategory;
  /** Returns all detections for this analyzer's category found within the subtree rooted at `root`. */
  detect(root: AnalyzableNode, ctx: AnalyzerContext): DetectedComponent[];
}

export interface DetectionInit {
  confidence: number;
  evidence: string[];
  variant?: string;
  label?: string;
  metadata?: DetectedComponent['metadata'];
}

export function makeDetection(
  category: ComponentCategory,
  node: AnalyzableNode,
  ctx: AnalyzerContext,
  init: DetectionInit,
): DetectedComponent {
  return {
    id: `${ctx.frameId}:${node.id}:${category}`,
    category,
    nodeId: node.id,
    nodeName: node.name,
    frameId: ctx.frameId,
    frameName: ctx.frameName,
    label: init.label,
    variant: init.variant,
    confidence: Math.max(0, Math.min(1, init.confidence)),
    evidence: init.evidence,
    metadata: init.metadata,
  };
}

/** Clamp confidence into [0, 1] after summing heuristic weights. */
export function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}
