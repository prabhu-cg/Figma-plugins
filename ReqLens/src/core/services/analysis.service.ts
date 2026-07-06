import { analyzerRegistry } from '@core/analyzers';
import type { AnalyzableNode } from '@core/types/figma-node.types';
import {
  type AnalysisResult,
  type ComponentCategoryCounts,
  type DetectedComponent,
  type FrameAnalysis,
  emptyCategoryCounts,
} from '@core/types/analysis.types';
import { countNodes } from '@core/utils/node-utils';

export interface AnalyzableFrame {
  frameId: string;
  frameName: string;
  root: AnalyzableNode;
  /** Passed through from selection serialization; true if the layer cap was hit. */
  truncated?: boolean;
}

const MIN_CONFIDENCE = 0.3;

/** Runs every registered analyzer over one frame and returns a de-duplicated, confidence-filtered analysis. */
export function analyzeFrame(frame: AnalyzableFrame): FrameAnalysis {
  const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const ctx = { frameId: frame.frameId, frameName: frame.frameName };

  const allDetections: DetectedComponent[] = [];
  for (const analyzer of analyzerRegistry) {
    const detections = analyzer.detect(frame.root, ctx).filter((d) => d.confidence >= MIN_CONFIDENCE);
    allDetections.push(...detections);
  }

  // A node can legitimately be flagged by multiple analyzers with the same category (name-based +
  // structural path); keep the highest-confidence detection per (nodeId, category) pair.
  const byKey = new Map<string, DetectedComponent>();
  for (const detection of allDetections) {
    const key = `${detection.nodeId}:${detection.category}`;
    const existing = byKey.get(key);
    if (!existing || detection.confidence > existing.confidence) byKey.set(key, detection);
  }

  const components = [...byKey.values()].sort((a, b) => b.confidence - a.confidence);
  const end = typeof performance !== 'undefined' ? performance.now() : Date.now();

  return {
    frameId: frame.frameId,
    frameName: frame.frameName,
    nodeCount: countNodes(frame.root),
    truncated: frame.truncated ?? false,
    components,
    analyzedAt: Date.now(),
    durationMs: end - start,
  };
}

export function analyzeFrames(frames: readonly AnalyzableFrame[]): AnalysisResult {
  const frameAnalyses = frames.map(analyzeFrame);
  const componentsByCategory: ComponentCategoryCounts = emptyCategoryCounts();
  let totalComponents = 0;

  for (const frame of frameAnalyses) {
    for (const component of frame.components) {
      componentsByCategory[component.category] += 1;
      totalComponents += 1;
    }
  }

  return {
    frames: frameAnalyses,
    totalComponents,
    componentsByCategory,
    multiFrame: frames.length > 1,
  };
}
