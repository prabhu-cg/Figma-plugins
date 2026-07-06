import { describe, expect, it } from 'vitest';
import { node, text } from '@core/utils/testFixtures';
import { tableAnalyzer } from './table.analyzer';

const ctx = { frameId: 'frame-1', frameName: 'Admin' };

function makeRow(id: string): ReturnType<typeof node> {
  return node({
    name: `Row ${id}`,
    id: `row-${id}`,
    type: 'FRAME',
    width: 600,
    height: 40,
    children: [text('Alice', { id: `${id}-name` }), text('alice@example.com', { id: `${id}-email` })],
  });
}

describe('tableAnalyzer', () => {
  it('detects a table by explicit naming', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [node({ name: 'Users Table', type: 'FRAME', children: [makeRow('1'), makeRow('2')] })],
    });

    const detections = tableAnalyzer.detect(root, ctx);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.nodeName).toBe('Users Table');
  });

  it('detects a table structurally from >= 3 repeated wide multi-column rows without special naming', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [
        node({
          name: 'Container',
          type: 'FRAME',
          children: [makeRow('1'), makeRow('2'), makeRow('3')],
        }),
      ],
    });

    const detections = tableAnalyzer.detect(root, ctx);
    expect(detections).toHaveLength(1);
    expect(detections[0]?.metadata?.rowCount).toBe(3);
  });

  it('does not detect a table from only 2 repeated rows (below the structural threshold)', () => {
    const root = node({
      name: 'Screen',
      type: 'FRAME',
      children: [node({ name: 'Container', type: 'FRAME', children: [makeRow('1'), makeRow('2')] })],
    });

    expect(tableAnalyzer.detect(root, ctx)).toHaveLength(0);
  });

});
