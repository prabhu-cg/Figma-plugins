/**
 * Cooperative-yielding helpers so long extraction/generation loops over
 * 10,000+ variables or 5,000+ components never block the plugin's event
 * loop long enough for Figma to consider it unresponsive.
 */

/** Yield control back to the event loop. */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run `fn` over `items` in batches, yielding between batches so the plugin
 * stays responsive and progress callbacks can flush to the UI. Items within a
 * batch run concurrently (so async work like Figma API lookups overlaps); results
 * keep the input order.
 */
export async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T, index: number) => Promise<R> | R,
  onBatch?: (done: number, total: number) => void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  for (let start = 0; start < items.length; start += batchSize) {
    const end = Math.min(start + batchSize, items.length);
    const batch = await Promise.all(
      items.slice(start, end).map((item, offset) => fn(item, start + offset)),
    );
    batch.forEach((result, offset) => {
      results[start + offset] = result;
    });
    onBatch?.(end, items.length);
    await yieldToEventLoop();
  }
  return results;
}

/** Wrap a fallible operation so one bad item can't abort a whole extraction pass. */
export async function safely<T>(
  fn: () => Promise<T> | T,
  onError: (err: unknown) => void,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    onError(err);
    return undefined;
  }
}
