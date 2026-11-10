import { describe, expect, it } from 'vitest';
import { formatRemaining } from '../../src/ui/components/ProgressBar';

describe('formatRemaining', () => {
  it('says nothing until there is enough elapsed time and progress', () => {
    expect(formatRemaining(2000, 10, 90)).toBe('');
    expect(formatRemaining(10_000, 0, 90)).toBe('');
    expect(formatRemaining(10_000, 10, 0)).toBe('');
  });

  it('says nothing for the last few seconds', () => {
    expect(formatRemaining(10_000, 90, 5)).toBe('');
  });

  it('uses seconds under a minute and a half, minutes above', () => {
    expect(formatRemaining(10_000, 10, 40)).toBe('about 40 s left');
    expect(formatRemaining(30_000, 100, 900)).toBe('about 5 min left');
  });
});
