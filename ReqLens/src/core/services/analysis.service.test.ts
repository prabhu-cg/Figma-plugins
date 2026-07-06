import { describe, expect, it } from 'vitest';
import { node, text } from '@core/utils/testFixtures';
import { analyzeFrame, analyzeFrames } from './analysis.service';

describe('analysis.service', () => {
  it('runs all analyzers over a frame and dedupes overlapping detections', () => {
    const root = node({
      name: 'Login Screen',
      type: 'FRAME',
      id: 'root',
      children: [
        node({ name: 'Email Input', type: 'INSTANCE', width: 240, height: 40, children: [text('Email')] }),
        node({ name: 'Primary Button', type: 'INSTANCE', width: 120, height: 40, children: [text('Sign in')] }),
      ],
    });

    const analysis = analyzeFrame({ frameId: 'frame-1', frameName: 'Login Screen', root });

    expect(analysis.components.some((c) => c.category === 'input')).toBe(true);
    expect(analysis.components.some((c) => c.category === 'button')).toBe(true);
    // No duplicate (nodeId, category) pairs.
    const keys = analysis.components.map((c) => `${c.nodeId}:${c.category}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('aggregates per-category counts across multiple frames', () => {
    const frameA = node({
      name: 'A',
      type: 'FRAME',
      id: 'a',
      children: [node({ name: 'Submit Button', type: 'INSTANCE', width: 100, height: 40 })],
    });
    const frameB = node({
      name: 'B',
      type: 'FRAME',
      id: 'b',
      children: [node({ name: 'Cancel Button', type: 'INSTANCE', width: 100, height: 40 })],
    });

    const result = analyzeFrames([
      { frameId: 'frame-a', frameName: 'A', root: frameA },
      { frameId: 'frame-b', frameName: 'B', root: frameB },
    ]);

    expect(result.multiFrame).toBe(true);
    expect(result.componentsByCategory.button).toBe(2);
    expect(result.totalComponents).toBe(2);
  });

  it('marks a frame as truncated when the caller reports the layer cap was hit', () => {
    const root = node({ name: 'Huge Frame', type: 'FRAME', id: 'root' });
    const analysis = analyzeFrame({ frameId: 'frame-1', frameName: 'Huge Frame', root, truncated: true });
    expect(analysis.truncated).toBe(true);
  });
});
