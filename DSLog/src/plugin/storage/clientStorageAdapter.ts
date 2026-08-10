import type { KVStore } from "./kvStore";

/** Wraps figma.clientStorage (per-user, local-machine) as a KVStore. */
export const clientStorageAdapter: KVStore = {
  async get(key) {
    const value = await figma.clientStorage.getAsync(key);
    return typeof value === "string" ? value : undefined;
  },
  async set(key, value) {
    await figma.clientStorage.setAsync(key, value);
  },
  async delete(key) {
    await figma.clientStorage.deleteAsync(key);
  },
  async keys() {
    return figma.clientStorage.keysAsync();
  },
};
