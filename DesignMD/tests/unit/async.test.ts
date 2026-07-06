import { describe, expect, it, vi } from 'vitest';
import { processInBatches, safely } from '../../src/plugin/utils/async';

describe('processInBatches', () => {
  it('processes every item and preserves order', async () => {
    const items = Array.from({ length: 250 }, (_, i) => i);
    const results = await processInBatches(items, 32, (n) => n * 2);
    expect(results).toEqual(items.map((n) => n * 2));
  });

  it('reports progress once per batch with running totals', async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const onBatch = vi.fn();
    await processInBatches(items, 4, (n) => n, onBatch);
    expect(onBatch).toHaveBeenCalledTimes(3);
    expect(onBatch).toHaveBeenLastCalledWith(10, 10);
  });

  it('handles an empty list without invoking the callback', async () => {
    const onBatch = vi.fn();
    const results = await processInBatches([], 10, (n) => n, onBatch);
    expect(results).toEqual([]);
    expect(onBatch).not.toHaveBeenCalled();
  });
});

describe('safely', () => {
  it('returns the value on success', async () => {
    const result = await safely(
      () => 42,
      () => {},
    );
    expect(result).toBe(42);
  });

  it('reports the error and returns undefined instead of throwing', async () => {
    const onError = vi.fn();
    const result = await safely(() => {
      throw new Error('boom');
    }, onError);

    expect(result).toBeUndefined();
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
