import { describe, expect, it } from 'vitest';
import { node, text } from '@core/utils/testFixtures';
import { tabsAnalyzer } from './tabs.analyzer';

const ctx = { frameId: 'frame-1', frameName: 'Settings' };

describe('tabsAnalyzer', () => {
  it('detects a tab group by explicit naming', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [node({ name: 'Tab Group', type: 'FRAME', children: [text('General'), text('Security')] })],
    });

    const detections = tabsAnalyzer.detect(root, ctx);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.category).toBe('tabs');
  });

  it('does not match a "Data Table" node — "table" is not a word-boundary match for "tab"', () => {
    const root = node({ name: 'Data Table', type: 'FRAME' });
    expect(tabsAnalyzer.detect(root, ctx)).toHaveLength(0);
  });
});
