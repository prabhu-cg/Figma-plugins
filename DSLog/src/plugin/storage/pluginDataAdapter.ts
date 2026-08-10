import type { KVStore } from "./kvStore";

/**
 * Wraps figma.root plugin data (document-attached) as a KVStore. Plugin
 * data travels with the .fig file itself, which is what makes "close
 * Figma, reopen, still see the baseline" work regardless of machine.
 */
export const pluginDataAdapter: KVStore = {
  async get(key) {
    const value = figma.root.getPluginData(key);
    return value === "" ? undefined : value;
  },
  async set(key, value) {
    figma.root.setPluginData(key, value);
  },
  async delete(key) {
    figma.root.setPluginData(key, "");
  },
  async keys() {
    return figma.root.getPluginDataKeys();
  },
};
