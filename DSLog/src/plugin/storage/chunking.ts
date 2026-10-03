import { utf8Decode, utf8Encode } from "@shared/utils/utf8";
import type { KVStore } from "./kvStore";

interface ChunkIndex {
  count: number;
  /**
   * Which generation of chunk keys the index points at. Absent in the original
   * layout, whose chunks live at `<prefix>:chunk:<i>`; newer writes use
   * `<prefix>:g<gen>:chunk:<i>`.
   */
  gen?: number;
}

function chunkKey(prefix: string, gen: number | undefined, i: number): string {
  return gen === undefined ? `${prefix}:chunk:${i}` : `${prefix}:g${gen}:chunk:${i}`;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matches chunk keys of every generation (and the original layout) for a prefix. */
function chunkKeyPattern(prefix: string): RegExp {
  return new RegExp(`^${escapeRegExp(prefix)}:(g\\d+:)?chunk:\\d+$`);
}

function parseIndex(raw: string | undefined): ChunkIndex | undefined {
  if (raw === undefined) return undefined;
  try {
    const index = JSON.parse(raw) as ChunkIndex;
    if (typeof index.count !== "number" || index.count < 0) return undefined;
    if (index.gen !== undefined && typeof index.gen !== "number") return undefined;
    return index;
  } catch {
    return undefined;
  }
}

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
    chunks.push(utf8Decode(bytes.subarray(start, end)));
    start = end;
  }
  return chunks;
}

/**
 * Chunked blobs are read, written and deleted as several separate key operations, so two operations on the
 * same blob must never overlap: a second save cleaning up "stale" chunks would delete the chunks a concurrent
 * save had just written, leaving the index pointing at data that no longer exists. Operations on one
 * (store, prefix) therefore run strictly one after another, in the order they were requested.
 */
const locks = new WeakMap<KVStore, Map<string, Promise<unknown>>>();

function withLock<T>(store: KVStore, prefix: string, task: () => Promise<T>): Promise<T> {
  let byPrefix = locks.get(store);
  if (!byPrefix) {
    byPrefix = new Map();
    locks.set(store, byPrefix);
  }
  const previous = byPrefix.get(prefix) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  byPrefix.set(prefix, tail);
  // Drop the entry once nothing newer is queued behind it, so the map doesn't grow with every prefix ever used.
  void tail.then(() => {
    if (byPrefix!.get(prefix) === tail) byPrefix!.delete(prefix);
  });
  return run;
}

/**
 * Splits JSON-serialized data across multiple keys so any single value stays
 * under platform per-key size limits (clientStorage and plugin data both
 * cap individual values — plugin data caps each entry at 100 kB, measured
 * in UTF-8 bytes).
 *
 * The write is crash-safe: the new chunks go to fresh keys (a new
 * generation), the index is switched over with a single set, and only then
 * are the previous chunks deleted. A failure at any point before the index
 * set leaves the previous data fully intact, so a failed save can never turn
 * a good project into one that reads back as empty or corrupt. Leftover
 * chunks from a failed cleanup are collected by the next successful write.
 */
export async function writeChunked(
  store: KVStore,
  prefix: string,
  data: unknown,
  chunkSizeBytes: number,
): Promise<void> {
  // Serialise now, so a save always stores the data as it was when it was requested.
  await writeChunkedSerialized(store, prefix, JSON.stringify(data), chunkSizeBytes);
}

/**
 * Like {@link writeChunked} for text that is already serialised (so the caller can compare it with what it last
 * wrote without stringifying twice). Resolves to the exact index record that was committed, which callers can
 * compare against the stored index later to confirm their copy is still what is on disk.
 */
export function writeChunkedSerialized(
  store: KVStore,
  prefix: string,
  serialized: string,
  chunkSizeBytes: number,
): Promise<string> {
  return withLock(store, prefix, () => writeSerialized(store, prefix, serialized, chunkSizeBytes));
}

async function writeSerialized(store: KVStore, prefix: string, serialized: string, chunkSizeBytes: number): Promise<string> {
  const bytes = utf8Encode(serialized);
  const chunks = splitUtf8Bytes(bytes, chunkSizeBytes);
  if (chunks.length === 0) chunks.push("");

  const previous = parseIndex(await store.get(`${prefix}:index`));
  const gen = (previous?.gen ?? 0) + 1;
  const newKeys = chunks.map((_, i) => chunkKey(prefix, gen, i));
  let committedIndex = "";

  try {
    await Promise.all(chunks.map((chunk, i) => store.set(newKeys[i]!, chunk)));
    const index: ChunkIndex = { count: chunks.length, gen };
    committedIndex = JSON.stringify(index);
    await store.set(`${prefix}:index`, committedIndex);
  } catch (error) {
    // The index still points at the previous generation; drop the half-written one.
    await Promise.allSettled(newKeys.map((k) => store.delete(k)));
    throw error;
  }

  // Committed. Cleanup is best-effort and must never fail the save.
  try {
    const live = new Set(newKeys);
    const pattern = chunkKeyPattern(prefix);
    const stale = (await store.keys()).filter((k) => pattern.test(k) && !live.has(k));
    await Promise.allSettled(stale.map((k) => store.delete(k)));
  } catch {
    // Orphans are harmless and get removed by the next write.
  }
  return committedIndex;
}

/** Returns undefined when nothing is stored, or when stored data is corrupted/unparseable. */
export async function readChunked<T>(store: KVStore, prefix: string): Promise<T | undefined> {
  const raw = await readChunkedRaw(store, prefix);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** The stored text exactly as it was written, or undefined when nothing usable is stored. */
export function readChunkedRaw(store: KVStore, prefix: string): Promise<string | undefined> {
  return withLock(store, prefix, () => readRawUnlocked(store, prefix));
}

async function readRawUnlocked(store: KVStore, prefix: string): Promise<string | undefined> {
  const index = parseIndex(await store.get(`${prefix}:index`));
  if (!index) return undefined;

  const parts: string[] = [];
  for (let i = 0; i < index.count; i++) {
    const part = await store.get(chunkKey(prefix, index.gen, i));
    if (part === undefined) return undefined;
    parts.push(part);
  }

  const serialized = parts.join("");
  return serialized === "" ? undefined : serialized;
}

export function deleteChunked(store: KVStore, prefix: string): Promise<void> {
  return withLock(store, prefix, () => deleteUnlocked(store, prefix));
}

async function deleteUnlocked(store: KVStore, prefix: string): Promise<void> {
  const pattern = chunkKeyPattern(prefix);
  const keys = await store.keys();
  const toDelete = keys.filter((k) => k === `${prefix}:index` || pattern.test(k));
  await Promise.all(toDelete.map((k) => store.delete(k)));
}
