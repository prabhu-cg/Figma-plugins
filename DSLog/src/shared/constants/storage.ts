/** clientStorage keys and chunking limits. */
export const STORAGE_SCHEMA_VERSION = 2;

export const STORAGE_KEYS = {
  /** Index record: lists chunk keys for the project blob. */
  projectIndex: "dslog:project:index",
  chunkPrefix: "dslog:project:chunk:",
  settings: "dslog:settings",
} as const;

/**
 * figma.clientStorage has no documented strict per-key size limit; this is
 * a conservative chunk size chosen for fast serialization, not a platform
 * ceiling.
 */
export const STORAGE_CHUNK_SIZE_CLIENT = 800_000;

/**
 * figma.root.setPluginData hard-caps each entry at 100 kB. Chunk well
 * under that: the 100 kB limit is measured in UTF-8 bytes, and JSON built
 * from component/variable names can include multi-byte characters, so a
 * character-count chunk size needs real headroom below 100,000.
 */
export const STORAGE_CHUNK_SIZE_PLUGIN_DATA = 40_000;

/** Batch size used while scanning to keep the UI responsive. */
export const SCAN_BATCH_SIZE = 25;
