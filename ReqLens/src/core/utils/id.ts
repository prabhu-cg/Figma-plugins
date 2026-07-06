/**
 * Deterministic 32-bit FNV-1a hash, hex-encoded. Used to derive stable,
 * storage-safe ids (selection signatures, question ids) without pulling in
 * a crypto dependency that may not be available identically in the Figma
 * sandbox and the UI iframe.
 */
export function stableHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** Order-independent signature for a set of selected frame ids, used as the responses storage key. */
export function selectionSignature(frameIds: readonly string[]): string {
  const sorted = [...frameIds].sort();
  return stableHash(sorted.join('|'));
}
