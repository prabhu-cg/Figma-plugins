let counter = 0;

/** Locally-unique id: no network/crypto dependency required. */
export function generateId(prefix: string): string {
  counter += 1;
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${random}`;
}
