import { describe, expect, it } from "vitest";
import { deleteChunked, readChunked, writeChunked } from "@plugin/storage/chunking";
import type { KVStore } from "@plugin/storage/kvStore";

/** A store whose operations yield to the event loop, so concurrent callers genuinely interleave. */
function createYieldingStore(): KVStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  const yieldTurn = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
  return {
    data,
    async get(key) {
      await yieldTurn();
      return data.get(key);
    },
    async set(key, value) {
      await yieldTurn();
      data.set(key, value);
    },
    async delete(key) {
      await yieldTurn();
      data.delete(key);
    },
    async keys() {
      await yieldTurn();
      return Array.from(data.keys());
    },
  };
}

const payload = (tag: string, size: number) => ({ tag, text: "x".repeat(size) });
const CHUNK = 50;

describe("concurrent writes to one blob", () => {
  it("a smaller write racing a larger one never leaves the blob unreadable", async () => {
    const store = createYieldingStore();
    await Promise.all([
      writeChunked(store, "p", payload("small", 60), CHUNK),
      writeChunked(store, "p", payload("large", 900), CHUNK),
    ]);
    expect(await readChunked(store, "p")).toEqual(payload("large", 900));
  });

  it("a larger write racing a smaller one: the last request wins and is intact", async () => {
    const store = createYieldingStore();
    await Promise.all([
      writeChunked(store, "p", payload("large", 900), CHUNK),
      writeChunked(store, "p", payload("small", 60), CHUNK),
    ]);
    expect(await readChunked(store, "p")).toEqual(payload("small", 60));
  });

  it("many overlapping writes of different sizes end with the last one, with no stray chunks", async () => {
    const store = createYieldingStore();
    const sizes = [300, 40, 1200, 10, 700, 2000, 55, 910, 5, 1500, 80, 640];
    const writes = sizes.map((size, i) => writeChunked(store, "p", payload(`w${i}`, size), CHUNK));
    await Promise.all(writes);

    const last = payload(`w${sizes.length - 1}`, sizes[sizes.length - 1]!);
    expect(await readChunked(store, "p")).toEqual(last);
    const chunkKeys = [...store.data.keys()].filter((k) => k.includes(":chunk:"));
    expect(chunkKeys).toHaveLength(Math.ceil(JSON.stringify(last).length / CHUNK));
  });

  it("a read during a write sees the old data or the new data, never a half-written blob", async () => {
    const store = createYieldingStore();
    await writeChunked(store, "p", payload("old", 500), CHUNK);

    const results = await Promise.all([
      writeChunked(store, "p", payload("new", 900), CHUNK),
      readChunked(store, "p"),
      readChunked(store, "p"),
    ]);
    for (const seen of results.slice(1)) {
      expect([payload("old", 500), payload("new", 900)]).toContainEqual(seen);
    }
  });

  it("a delete queued behind a write removes everything the write created", async () => {
    const store = createYieldingStore();
    await Promise.all([writeChunked(store, "p", payload("a", 400), CHUNK), deleteChunked(store, "p")]);
    expect(await readChunked(store, "p")).toBeUndefined();
    expect(store.data.size).toBe(0);
  });

  it("different prefixes do not block or disturb each other", async () => {
    const store = createYieldingStore();
    await Promise.all([
      writeChunked(store, "a", payload("a", 700), CHUNK),
      writeChunked(store, "b", payload("b", 90), CHUNK),
    ]);
    expect(await readChunked(store, "a")).toEqual(payload("a", 700));
    expect(await readChunked(store, "b")).toEqual(payload("b", 90));
  });

  it("a failed write does not block the writes queued behind it", async () => {
    const store = createYieldingStore();
    const realSet = store.set.bind(store);
    let failNext = true;
    store.set = async (key, value) => {
      if (failNext) {
        failNext = false;
        throw new Error("storage full");
      }
      return realSet(key, value);
    };
    const first = writeChunked(store, "p", payload("first", 300), CHUNK);
    const second = writeChunked(store, "p", payload("second", 120), CHUNK);
    await expect(first).rejects.toThrow("storage full");
    await expect(second).resolves.toBeUndefined();
    expect(await readChunked(store, "p")).toEqual(payload("second", 120));
  });
});
