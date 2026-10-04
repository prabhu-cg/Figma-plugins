export class ScanCancelledError extends Error {
  constructor() {
    super("Scan was cancelled");
    this.name = "ScanCancelledError";
  }
}

const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * Cooperative checkpoint for long loops. The plugin sandbox is single-threaded, so a cancel
 * message from the UI is only delivered when the running code yields. Calling the returned
 * function is nearly free until `budgetMs` has passed since the last yield; then it hands
 * control back to the event loop (letting the cancel message, and Figma's own UI, through)
 * and throws if cancellation was requested in the meantime.
 */
export function createCheckpoint(
  isCancelled: () => boolean,
  budgetMs = 25,
  now: () => number = Date.now
): () => Promise<void> {
  let lastYield = now();
  return async () => {
    if (now() - lastYield < budgetMs) return;
    await yieldToEventLoop();
    lastYield = now();
    if (isCancelled()) throw new ScanCancelledError();
  };
}
