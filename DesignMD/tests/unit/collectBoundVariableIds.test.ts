import { describe, expect, it } from 'vitest';
import { collectBoundVariableIds } from '../../src/plugin/extraction/styles';

describe('collectBoundVariableIds', () => {
  it('returns an empty array for null/undefined', () => {
    expect(collectBoundVariableIds(undefined)).toEqual([]);
    expect(collectBoundVariableIds(null)).toEqual([]);
  });

  it('finds a variable alias nested one level deep', () => {
    const ids = collectBoundVariableIds({ fills: { type: 'VARIABLE_ALIAS', id: 'var:1' } });
    expect(ids).toEqual(['var:1']);
  });

  it('finds variable aliases nested inside arrays', () => {
    const ids = collectBoundVariableIds({
      fills: [
        { type: 'VARIABLE_ALIAS', id: 'var:1' },
        { type: 'VARIABLE_ALIAS', id: 'var:2' },
      ],
    });
    expect(ids.sort()).toEqual(['var:1', 'var:2']);
  });

  it('deduplicates repeated ids', () => {
    const ids = collectBoundVariableIds({
      a: { type: 'VARIABLE_ALIAS', id: 'var:1' },
      b: { type: 'VARIABLE_ALIAS', id: 'var:1' },
    });
    expect(ids).toEqual(['var:1']);
  });

  it('ignores non-alias values without crashing', () => {
    expect(collectBoundVariableIds({ opacity: 0.5, color: { r: 1, g: 0, b: 0 } })).toEqual([]);
  });
});
