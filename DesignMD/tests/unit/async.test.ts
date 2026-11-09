import { describe, expect, it, vi } from 'vitest';
import {
  createTimeSlicer,
  isCancelled,
  processInBatches,
  safely,
  withCancellation,
} from '../../src/plugin/utils/async';

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

  it('runs items within a batch concurrently but batches sequentially', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 8 }, (_, i) => i);
    const results = await processInBatches(items, 4, async (n) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return n;
    });
    expect(results).toEqual(items);
    expect(maxInFlight).toBe(4);
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

describe('cancellation', () => {
  it('stops before the next batch and returns only the finished batches', async () => {
    let cancelled = false;
    const seen: number[] = [];
    const result = await withCancellation(
      () => cancelled,
      () =>
        processInBatches([1, 2, 3, 4, 5, 6], 2, (n) => {
          seen.push(n);
          if (n === 3) cancelled = true;
          return n * 10;
        }),
    );
    expect(seen).toEqual([1, 2, 3, 4]);
    expect(result).toEqual([10, 20, 30, 40]);
  });

  it('does nothing outside withCancellation, and restores the previous state afterwards', async () => {
    expect(isCancelled()).toBe(false);
    await withCancellation(
      () => true,
      async () => {
        expect(isCancelled()).toBe(true);
      },
    );
    expect(isCancelled()).toBe(false);
    expect(await processInBatches([1, 2, 3], 2, (n) => n)).toEqual([1, 2, 3]);
  });

  it('restores the state even when the work throws', async () => {
    await expect(
      withCancellation(
        () => true,
        async () => {
          throw new Error('x');
        },
      ),
    ).rejects.toThrow('x');
    expect(isCancelled()).toBe(false);
  });
});

describe('createTimeSlicer', () => {
  it('does not yield until the interval has passed, then yields and starts a new interval', async () => {
    let t = 0;
    const slice = createTimeSlicer(10, () => t);
    const spy = vi.spyOn(globalThis, 'setTimeout');
    await slice();
    t = 9;
    await slice();
    expect(spy).not.toHaveBeenCalled();
    t = 10;
    await slice();
    expect(spy).toHaveBeenCalledTimes(1);
    t = 15;
    await slice(); // only 5 ms since the yield
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
