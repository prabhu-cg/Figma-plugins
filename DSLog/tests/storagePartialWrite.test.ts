import { describe, expect, it } from "vitest";
import { deleteChunked, readChunked, writeChunked } from "@plugin/storage/chunking";
import type { KVStore } from "@plugin/storage/kvStore";

function createMemoryStore() {
  const data = new Map<string, string>();
  let failAfterSets: number | undefined;
  let failDeletes = false;
  let sets = 0;
  const store: KVStore & {
    data: Map<string, string>;
    failAfter(n: number | undefined): void;
    failDeletes(v: boolean): void;
  } = {
    data,
    failAfter(n) {
      failAfterSets = n;
      sets = 0;
    },
    failDeletes(v) {
      failDeletes = v;
    },
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      if (failAfterSets !== undefined && sets >= failAfterSets) throw new Error("storage full");
      sets++;
      data.set(key, value);
    },
    async delete(key) {
      if (failDeletes) throw new Error("delete failed");
      data.delete(key);
    },
    async keys() {
      return Array.from(data.keys());
    },
  };
  return store;
}

const big = (tag: string) => ({ tag, text: "x".repeat(500) });

describe("writeChunked partial-write safety", () => {
  it.each([0, 1, 3, 5])("a write that fails after %i sets leaves the previous data readable", async (okSets) => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("old"), 50);

    store.failAfter(okSets);
    await expect(writeChunked(store, "p", big("new"), 50)).rejects.toThrow("storage full");

    store.failAfter(undefined);
    expect(await readChunked(store, "p")).toEqual(big("old"));
  });

  it("a failed write that would have shrunk the data still leaves the old data readable", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("old"), 50);
    store.failAfter(0);
    await expect(writeChunked(store, "p", { tag: "small" }, 50)).rejects.toThrow();
    store.failAfter(undefined);
    expect(await readChunked(store, "p")).toEqual(big("old"));
  });

  it("a failed write does not leave orphaned chunks behind", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("old"), 50);
    const keysBefore = [...store.data.keys()].sort();
    store.failAfter(3);
    await expect(writeChunked(store, "p", big("new"), 50)).rejects.toThrow();
    store.failAfter(undefined);
    expect([...store.data.keys()].sort()).toEqual(keysBefore);
  });

  it("a successful write replaces the data and removes the previous chunks", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("one"), 50);
    await writeChunked(store, "p", { tag: "two" }, 50);
    expect(await readChunked(store, "p")).toEqual({ tag: "two" });
    expect([...store.data.keys()].filter((k) => k.includes(":chunk:"))).toHaveLength(1);
  });

  it("a failure while cleaning up old chunks does not fail the (already committed) save", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("old"), 50);
    store.failDeletes(true);
    await expect(writeChunked(store, "p", big("new"), 50)).resolves.toBeUndefined();
    expect(await readChunked(store, "p")).toEqual(big("new"));

    // Leftovers are collected on the next successful write.
    store.failDeletes(false);
    await writeChunked(store, "p", big("newer"), 50);
    expect(await readChunked(store, "p")).toEqual(big("newer"));
    const chunkKeys = [...store.data.keys()].filter((k) => k.includes(":chunk:"));
    expect(chunkKeys).toHaveLength(Math.ceil(JSON.stringify(big("newer")).length / 50));
  });

  it("still reads data written in the original un-versioned layout, and upgrades it on the next write", async () => {
    const store = createMemoryStore();
    const legacy = big("legacy");
    const json = JSON.stringify(legacy);
    const parts = json.match(/[\s\S]{1,50}/g)!;
    parts.forEach((part, i) => store.data.set(`p:chunk:${i}`, part));
    store.data.set("p:index", JSON.stringify({ count: parts.length }));

    expect(await readChunked(store, "p")).toEqual(legacy);

    await writeChunked(store, "p", big("upgraded"), 50);
    expect(await readChunked(store, "p")).toEqual(big("upgraded"));
    expect([...store.data.keys()].some((k) => /^p:chunk:\d+$/.test(k))).toBe(false);
  });

  it("deleteChunked removes versioned and legacy chunks without touching other prefixes", async () => {
    const store = createMemoryStore();
    await writeChunked(store, "p", big("a"), 50);
    await writeChunked(store, "p2", big("b"), 50);
    store.data.set("p:chunk:0", "legacy leftover");
    await deleteChunked(store, "p");
    expect([...store.data.keys()].filter((k) => k.startsWith("p:"))).toEqual([]);
    expect(await readChunked(store, "p2")).toEqual(big("b"));
  });
});
