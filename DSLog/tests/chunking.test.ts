import { describe, expect, it } from "vitest";
import { readChunked, writeChunked } from "@plugin/storage/chunking";
import type { KVStore } from "@plugin/storage/kvStore";

function createMemoryStore(): KVStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
    async keys() {
      return Array.from(data.keys());
    },
  };
}

describe("chunking", () => {
  it("round-trips small data within a single chunk", async () => {
    const store = createMemoryStore();
    const payload = { hello: "world", items: [1, 2, 3] };
    await writeChunked(store, "test", payload, 1000);
    const result = await readChunked(store, "test");
    expect(result).toEqual(payload);
  });

  it("splits data larger than chunk size across multiple keys", async () => {
    const store = createMemoryStore();
    const payload = { text: "x".repeat(500) };
    await writeChunked(store, "test", payload, 50);
    const chunkKeys = Array.from(store.data.keys()).filter((k) => k.startsWith("test:chunk:"));
    expect(chunkKeys.length).toBeGreaterThan(1);
    const result = await readChunked(store, "test");
    expect(result).toEqual(payload);
  });

  it("clears stale trailing chunks when new data is smaller", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "test", { text: "x".repeat(500) }, 50);
    await writeChunked(store, "test", { text: "small" }, 50);
    const result = await readChunked<{ text: string }>(store, "test");
    expect(result?.text).toBe("small");
  });

  it("returns undefined when nothing has been written", async () => {
    const store = createMemoryStore();
    expect(await readChunked(store, "missing")).toBeUndefined();
  });

  it("returns undefined when a chunk is missing (storage corruption)", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "test", { text: "x".repeat(500) }, 50);
    await store.delete("test:chunk:1");
    expect(await readChunked(store, "test")).toBeUndefined();
  });

  it("returns undefined when the index is unparseable JSON", async () => {
    const store = createMemoryStore();
    await store.set("test:index", "{not json");
    expect(await readChunked(store, "test")).toBeUndefined();
  });
});
