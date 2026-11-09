import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../src/shared/sha256';

describe('sha256', () => {
  it.each([
    '',
    'abc',
    'a'.repeat(55),
    'a'.repeat(56),
    'a'.repeat(64),
    'a'.repeat(1000),
    'héllo wörld ✓ 😀',
    '{\n  "x": 1\n}\n',
  ])('matches node crypto for %j', (input) => {
    expect(sha256(input)).toBe(createHash('sha256').update(input).digest('hex'));
  });
});
