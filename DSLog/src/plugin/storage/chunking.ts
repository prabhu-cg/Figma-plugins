import type { KVStore } from "./kvStore";

interface ChunkIndex {
  count: number;
}

/**
 * Splits JSON-serialized data across multiple keys so any single value stays
 * under platform per-key size limits (clientStorage and plugin data both
 * cap individual values). Old chunks are cleared first so a shrinking blob
 * doesn't leave stale trailing chunks behind.
 */
export async function writeChunked(store: KVStore, prefix: string, data: unknown, chunkSize: number): Promise<void> {
  const serialized = JSON.stringify(data);
  const chunks: string[] = [];
  for (let i = 0; i < serialized.length; i += chunkSize) {
    chunks.push(serialized.slice(i, i + chunkSize));
  }
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
