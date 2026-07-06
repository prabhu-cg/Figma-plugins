import { describe, expect, it } from 'vitest';
import { node } from '@core/utils/testFixtures';
import { dropdownAnalyzer } from './dropdown.analyzer';

const ctx = { frameId: 'frame-1', frameName: 'Filters' };

describe('dropdownAnalyzer', () => {
  it('detects a dropdown by explicit naming', () => {
    const root = node({ name: 'Screen', type: 'FRAME', children: [node({ name: 'Country Dropdown', type: 'INSTANCE' })] });
    expect(dropdownAnalyzer.detect(root, ctx)).toHaveLength(1);
  });

  it('detects an unnamed instance via a chevron icon child', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [
        node({
          name: 'Filter Field',
          type: 'INSTANCE',
          children: [node({ name: 'chevron-down', type: 'VECTOR', width: 12, height: 12 })],
        }),
      ],
    });

    const detections = dropdownAnalyzer.detect(root, ctx);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.evidence.join(' ')).toContain('chevron');
  });
});
