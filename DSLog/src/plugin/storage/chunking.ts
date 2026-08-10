import type { KVStore } from "./kvStore";

interface ChunkIndex {
  count: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function isUtf8ContinuationByte(byte: number): boolean {
  return (byte & 0b11000000) === 0b10000000;
}

/**
 * Splits a UTF-8 byte array into chunks no larger than `chunkSizeBytes`,
 * never cutting inside a multi-byte character. Design system names can
 * contain non-ASCII text, so a naive character-count split (1 JS string
 * unit is not 1 byte) can silently produce a chunk larger than the
 * platform's byte-based per-entry limit; this walks each cut point back to
 * the start of a character when it would otherwise land mid-sequence.
 */
function splitUtf8Bytes(bytes: Uint8Array, chunkSizeBytes: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    let end = Math.min(start + chunkSizeBytes, bytes.length);
    while (end > start && end < bytes.length && isUtf8ContinuationByte(bytes[end] ?? 0)) {
      end--;
    }
    if (end <= start) {
      // The character starting at `start` is longer than chunkSizeBytes
      // itself (only possible with a pathologically small chunk size).
      // Extend forward to include the whole character rather than cut it
      // — correctness over the nominal size cap in this rare case.
      end = start + 1;
      while (end < bytes.length && isUtf8ContinuationByte(bytes[end] ?? 0)) {
        end++;
      }
    }
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
  }
  return chunks;
}

/**
 * Splits JSON-serialized data across multiple keys so any single value stays
 * under platform per-key size limits (clientStorage and plugin data both
 * cap individual values — plugin data caps each entry at 100 kB, measured
 * in UTF-8 bytes). Old chunks are cleared first so a shrinking blob doesn't
 * leave stale trailing chunks behind.
 */
export async function writeChunked(
  store: KVStore,
  prefix: string,
  data: unknown,
  chunkSizeBytes: number,
): Promise<void> {
  const serialized = JSON.stringify(data);
  const bytes = encoder.encode(serialized);
  const chunks = splitUtf8Bytes(bytes, chunkSizeBytes);
  if (chunks.length === 0) chunks.push("");

  const existingKeys = await store.keys();
  const staleChunkKeys = existingKeys.filter(
    (k) => k.startsWith(`${prefix}:chunk:`) && Number(k.slice(`${prefix}:chunk:`.length)) >= chunks.length,
  );
  await Promise.all(staleChunkKeys.map((k) => store.delete(k)));

  await Promise.all(chunks.map((chunk, i) => store.set(`${prefix}:chunk:${i}`, chunk)));
  const index: ChunkIndex = { count: chunks.length };
  await store.set(`${prefix}:index`, JSON.stringify(index));
}

/** Returns undefined when nothing is stored, or when stored data is corrupted/unparseable. */
export async function readChunked<T>(store: KVStore, prefix: string): Promise<T | undefined> {
  const indexRaw = await store.get(`${prefix}:index`);
  if (indexRaw === undefined) return undefined;

  let index: ChunkIndex;
  try {
    index = JSON.parse(indexRaw) as ChunkIndex;
  } catch {
    return undefined;
  }
  if (typeof index.count !== "number" || index.count < 0) return undefined;

  const parts: string[] = [];
  for (let i = 0; i < index.count; i++) {
    const part = await store.get(`${prefix}:chunk:${i}`);
    if (part === undefined) return undefined;
    parts.push(part);
  }

  const serialized = parts.join("");
  if (serialized === "") return undefined;

  try {
    return JSON.parse(serialized) as T;
  } catch {
    return undefined;
  }
}

export async function deleteChunked(store: KVStore, prefix: string): Promise<void> {
  const keys = await store.keys();
  const toDelete = keys.filter((k) => k === `${prefix}:index` || k.startsWith(`${prefix}:chunk:`));
  await Promise.all(toDelete.map((k) => store.delete(k)));
}
