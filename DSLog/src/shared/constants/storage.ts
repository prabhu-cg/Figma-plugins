/** clientStorage keys and chunking limits. */
export const STORAGE_SCHEMA_VERSION = 1;

export const STORAGE_KEYS = {
  /** Index record: lists chunk keys for the project blob. */
  projectIndex: "dslog:project:index",
  chunkPrefix: "dslog:project:chunk:",
  settings: "dslog:settings",
} as const;

/**
 * Figma clientStorage values should stay well under the platform's per-key
 * limit; we conservatively chunk serialized JSON into pieces of this size.
 */
export const STORAGE_CHUNK_SIZE = 800_000;

/** Batch size used while scanning to keep the UI responsive. */
export const SCAN_BATCH_SIZE = 25;
