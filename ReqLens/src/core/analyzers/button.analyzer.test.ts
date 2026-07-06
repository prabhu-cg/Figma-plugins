import { describe, expect, it } from 'vitest';
import { node, text } from '@core/utils/testFixtures';
import { buttonAnalyzer } from './button.analyzer';

const ctx = { frameId: 'frame-1', frameName: 'Checkout' };

describe('buttonAnalyzer', () => {
  it('detects an instance named like a primary button', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [node({ name: 'Primary Button', type: 'INSTANCE', width: 120, height: 40, children: [text('Submit')] })],
    });

    const detections = buttonAnalyzer.detect(root, ctx);
    const detection = detections[0];
    if (!detection) throw new Error('expected a button detection');

    expect(detection.category).toBe('button');
    expect(detection.variant).toBe('primary');
    expect(detection.label).toBe('Submit');
    expect(detection.confidence).toBeGreaterThan(0.5);
  });

  it('classifies ghost/outline naming as tertiary and secondary respectively', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [
        node({ name: 'Ghost Button', type: 'COMPONENT', width: 100, height: 36 }),
        node({ name: 'Secondary Btn', type: 'COMPONENT', width: 100, height: 36 }),
      ],
    });

    const detections = buttonAnalyzer.detect(root, ctx);
    const ghost = detections.find((d) => d.nodeName === 'Ghost Button');
    const secondary = detections.find((d) => d.nodeName === 'Secondary Btn');

    expect(ghost?.variant).toBe('tertiary');
    expect(secondary?.variant).toBe('secondary');
  });

  it('does not flag unrelated text layers as buttons', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [text('Welcome back'), node({ name: 'Hero Image', type: 'RECTANGLE' })],
    });

    expect(buttonAnalyzer.detect(root, ctx)).toHaveLength(0);
  });

  it('does not double-count a button and its own text child as two matches', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [node({ name: 'Save Button', type: 'INSTANCE', width: 100, height: 40, children: [text('Save')] })],
    });

    expect(buttonAnalyzer.detect(root, ctx)).toHaveLength(1);
  });
});
