import { describe, expect, it } from 'vitest';
import { selectionSignature, stableHash } from './id';

describe('stableHash', () => {
  it('is deterministic for the same input', () => {
    expect(stableHash('hello')).toBe(stableHash('hello'));
  });

  it('differs for different inputs', () => {
    expect(stableHash('hello')).not.toBe(stableHash('world'));
  });
});

describe('selectionSignature', () => {
  it('is order-independent', () => {
    expect(selectionSignature(['a', 'b', 'c'])).toBe(selectionSignature(['c', 'a', 'b']));
  });

  it('differs when the set of ids differs', () => {
    expect(selectionSignature(['a', 'b'])).not.toBe(selectionSignature(['a', 'b', 'c']));
  });
});
