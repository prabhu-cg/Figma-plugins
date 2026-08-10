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

  it("never writes a chunk larger than the requested byte size, even with multi-byte characters", async () => {
    const store = createMemoryStore();
    const encoder = new TextEncoder();
    // Mix of CJK (3 bytes/char in UTF-8) and emoji (4 bytes) so naive
    // character-count slicing would exceed the byte budget and/or split a
    // character across chunk boundaries.
    const payload = { text: "设计系统令牌🎨".repeat(200) };
    const chunkSizeBytes = 37;
    await writeChunked(store, "test", payload, chunkSizeBytes);

    const chunkKeys = Array.from(store.data.keys()).filter((k) => k.startsWith("test:chunk:"));
    expect(chunkKeys.length).toBeGreaterThan(1);
    for (const key of chunkKeys) {
      const bytes = encoder.encode(store.data.get(key) ?? "");
      expect(bytes.length).toBeLessThanOrEqual(chunkSizeBytes);
    }

    const result = await readChunked<typeof payload>(store, "test");
    expect(result).toEqual(payload);
  });

  it("round-trips correctly regardless of where the byte budget falls relative to character boundaries", async () => {
    const store = createMemoryStore();
    const payload = { text: "🎨".repeat(50) };
    // Try every chunk size from 1..20 bytes — since each emoji is a 4-byte
    // surrogate pair, most of these force a cut point that would otherwise
    // land mid-character.
    for (let chunkSizeBytes = 1; chunkSizeBytes <= 20; chunkSizeBytes++) {
      await writeChunked(store, "test", payload, chunkSizeBytes);
      const result = await readChunked<typeof payload>(store, "test");
      expect(result).toEqual(payload);
    }
  });

  it("stays within the real 100 kB Figma pluginData entry limit at realistic scan sizes", async () => {
    const store = createMemoryStore();
    const encoder = new TextEncoder();
    // Roughly approximates one baseline's worth of component/token names.
    const bigPayload = {
      components: Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, name: `设计组件 Component ${i} 🔘` })),
    };
    const PLUGIN_DATA_LIMIT_BYTES = 100_000;
    const chunkSizeBytes = 40_000;
    await writeChunked(store, "test", bigPayload, chunkSizeBytes);

    for (const [key, value] of store.data) {
      if (!key.startsWith("test:chunk:")) continue;
      expect(encoder.encode(value).length).toBeLessThan(PLUGIN_DATA_LIMIT_BYTES);
    }

    expect(await readChunked(store, "test")).toEqual(bigPayload);
  });
});
