import {
  STORAGE_CHUNK_SIZE_CLIENT,
  STORAGE_CHUNK_SIZE_PLUGIN_DATA,
  STORAGE_SCHEMA_VERSION,
} from "@shared/constants/storage";
import type { Baseline, Project, Settings } from "@shared/types/project";
import { createEmptyProject, DEFAULT_SETTINGS } from "@shared/types/project";
import type { ChangeSet } from "@shared/types/change";
import type { DesignSystemSnapshot } from "@shared/types/project";
import type { TrackedEntity } from "@shared/types/entity";
import type { InstanceIndex } from "@shared/types/instance";
import { migrateProject } from "@shared/schemas/validate";
import { clientStorageAdapter } from "./clientStorageAdapter";
import { pluginDataAdapter } from "./pluginDataAdapter";
import type { KVStore } from "./kvStore";
import { deleteChunked, readChunked, readChunkedRaw, writeChunkedSerialized } from "./chunking";

/**
 * Layout (see docs/storage-schema.md):
 *
 *   clientStorage   dslog:meta              baselines (without snapshots), releases, tracked entities, settings
 *   plugin data     dslog:manifest          which parts exist
 *                   dslog:snap:<baselineId> one baseline's snapshot            (immutable once created)
 *                   dslog:cs:<changeSetId>  one change set                      (edited by review actions)
 *                   dslog:instances         the impact index, if built
 *
 * Each part is its own chunked blob, so a review action rewrites one change set instead of the whole project.
 * The original single `dslog:heavy` blob is still read, and removed after the first save in the new layout.
 */
const META_PREFIX = "dslog:meta";
const MANIFEST_PREFIX = "dslog:manifest";
const INSTANCES_PREFIX = "dslog:instances";
const LEGACY_HEAVY_PREFIX = "dslog:heavy";
const snapshotPrefix = (baselineId: string) => `dslog:snap:${baselineId}`;
const changeSetPrefix = (changeSetId: string) => `dslog:cs:${changeSetId}`;
const PART_INDEX_PATTERN = /^dslog:(snap|cs):(.+):index$/;

type BaselineWithoutSnapshot = Omit<Baseline, "snapshot">;

interface StoredMeta {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: BaselineWithoutSnapshot[];
  releases: Project["releases"];
  trackedEntities: TrackedEntity[];
  settings: Settings;
}

interface Manifest {
  layout: 2;
  snapshots: string[];
  changeSets: string[];
  instanceIndex: boolean;
}

interface LegacyHeavyData {
  snapshots: Record<string, DesignSystemSnapshot>;
  changeSets: ChangeSet[];
  instanceIndex?: InstanceIndex;
}

function isStoredMeta(value: unknown): value is StoredMeta {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.schemaVersion === "number" &&
    Array.isArray(v.baselines) &&
    Array.isArray(v.releases) &&
    typeof v.settings === "object" &&
    v.settings !== null
  );
}

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.layout === 2 && Array.isArray(v.snapshots) && Array.isArray(v.changeSets);
}

function isLegacyHeavy(value: unknown): value is LegacyHeavyData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.snapshots === "object" && v.snapshots !== null && Array.isArray(v.changeSets);
}

const EMPTY_SNAPSHOT: DesignSystemSnapshot = { components: [], tokens: [], collections: [] };

// ---------------------------------------------------------------------------------------------------------
// What was last written, so a save can skip parts that have not changed.
// ---------------------------------------------------------------------------------------------------------

/**
 * `index` is the exact index record written for the part; before trusting this entry the store's current index
 * must still equal it, so a store that was wiped or changed underneath us is rewritten, not assumed intact.
 * Snapshots are immutable, so they are recognised by object identity (`source`) and never re-serialised.
 * Everything else keeps its serialised text (`serialized`) to compare against, because change sets are edited
 * in place by several handlers and identity alone can't tell.
 */
interface PartRecord {
  index: string;
  serialized?: string;
  source?: object;
}

const records = new WeakMap<KVStore, Map<string, PartRecord>>();

function recordsFor(store: KVStore): Map<string, PartRecord> {
  let map = records.get(store);
  if (!map) {
    map = new Map();
    records.set(store, map);
  }
  return map;
}

async function stillStored(store: KVStore, prefix: string, record: PartRecord): Promise<boolean> {
  return (await store.get(`${prefix}:index`)) === record.index;
}

export interface SaveStats {
  partsWritten: number;
  partsChecked: number;
  bytesWritten: number;
  ms: number;
}

let saveLogger: ((stats: SaveStats) => void) | undefined;

/** Receives a summary after every save (the plugin entry point sends it to the console; tests leave it unset). */
export function setSaveLogger(logger: ((stats: SaveStats) => void) | undefined): void {
  saveLogger = logger;
}

async function savePart(
  store: KVStore,
  prefix: string,
  chunkSize: number,
  part: { source: object } | { serialize: () => string },
  stats: SaveStats,
): Promise<boolean> {
  stats.partsChecked++;
  const map = recordsFor(store);
  const record = map.get(prefix);

  if ("source" in part) {
    if (record && record.source === part.source && (await stillStored(store, prefix, record))) return false;
    const serialized = JSON.stringify(part.source);
    const index = await writeChunkedSerialized(store, prefix, serialized, chunkSize);
    map.set(prefix, { index, source: part.source });
    stats.partsWritten++;
    stats.bytesWritten += serialized.length;
    return true;
  }

  const serialized = part.serialize();
  if (record && record.serialized === serialized && (await stillStored(store, prefix, record))) return false;
  const index = await writeChunkedSerialized(store, prefix, serialized, chunkSize);
  map.set(prefix, { index, serialized });
  stats.partsWritten++;
  stats.bytesWritten += serialized.length;
  return true;
}

// ---------------------------------------------------------------------------------------------------------
// Load
// ---------------------------------------------------------------------------------------------------------

async function loadParts(): Promise<{
  snapshots: Record<string, DesignSystemSnapshot>;
  changeSets: ChangeSet[];
  instanceIndex?: InstanceIndex;
}> {
  const map = recordsFor(pluginDataAdapter);
  const manifest = await readChunked<unknown>(pluginDataAdapter, MANIFEST_PREFIX);

  if (!isManifest(manifest)) {
    // Original layout: everything in one blob (or nothing stored yet).
    const legacy = await readChunked<unknown>(pluginDataAdapter, LEGACY_HEAVY_PREFIX);
    return isLegacyHeavy(legacy) ? legacy : { snapshots: {}, changeSets: [] };
  }

  const snapshots: Record<string, DesignSystemSnapshot> = {};
  for (const id of manifest.snapshots) {
    const prefix = snapshotPrefix(id);
    const raw = await readChunkedRaw(pluginDataAdapter, prefix);
    if (raw === undefined) continue; // a missing snapshot degrades to "empty", never to losing the baseline
    try {
      const snapshot = JSON.parse(raw) as DesignSystemSnapshot;
      snapshots[id] = snapshot;
      const index = await pluginDataAdapter.get(`${prefix}:index`);
      if (index !== undefined) map.set(prefix, { index, source: snapshot });
    } catch {
      // unreadable: treated as missing
    }
  }

  const changeSets: ChangeSet[] = [];
  for (const id of manifest.changeSets) {
    const prefix = changeSetPrefix(id);
    const raw = await readChunkedRaw(pluginDataAdapter, prefix);
    if (raw === undefined) continue;
    try {
      changeSets.push(JSON.parse(raw) as ChangeSet);
      const index = await pluginDataAdapter.get(`${prefix}:index`);
      if (index !== undefined) map.set(prefix, { index, serialized: raw });
    } catch {
      // unreadable: that change set is dropped, the rest of the project still loads
    }
  }

  const instanceIndex = manifest.instanceIndex ? await readChunked<InstanceIndex>(pluginDataAdapter, INSTANCES_PREFIX) : undefined;
  return { snapshots, changeSets, instanceIndex };
}

export async function loadProject(): Promise<Project> {
  const metaRaw = await readChunked<unknown>(clientStorageAdapter, META_PREFIX);
  if (!isStoredMeta(metaRaw)) {
    return createEmptyProject(STORAGE_SCHEMA_VERSION);
  }

  const heavy = await loadParts();

  const baselines: Baseline[] = metaRaw.baselines.map((b) => ({
    ...b,
    snapshot: heavy.snapshots[b.id] ?? EMPTY_SNAPSHOT,
  }));

  // Route every load through migrateProject: it's a no-op on already-current
  // data (confirmed by schemaValidation.test.ts) and backfills/repairs older
  // schema shapes (e.g. v1's `reviewed: boolean` -> v2's `reviewState`,
  // missing `trackedEntities`) so a project created under an older
  // schemaVersion keeps working after this upgrade.
  return migrateProject({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    currentBaselineId: metaRaw.currentBaselineId,
    baselines,
    releases: metaRaw.releases ?? [],
    changeSets: heavy.changeSets,
    trackedEntities: metaRaw.trackedEntities ?? [],
    instanceIndex: heavy.instanceIndex,
    settings: { ...DEFAULT_SETTINGS, ...metaRaw.settings },
  });
}

// ---------------------------------------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------------------------------------

let saveTail: Promise<void> = Promise.resolve();

/**
 * Saves are serialised: the parts below must be written in a fixed order (see writeProject), and two overlapping
 * saves would interleave those writes. Each save serialises the project when it actually runs, so a queued save
 * always stores the newest state.
 */
export function saveProject(project: Project): Promise<void> {
  const run = saveTail.catch(() => undefined).then(() => writeProject(project));
  saveTail = run.catch(() => undefined);
  return run;
}

async function removeUnlistedParts(manifest: Manifest, hadInstances: boolean): Promise<void> {
  const keep = new Set<string>([
    ...manifest.snapshots.map(snapshotPrefix),
    ...manifest.changeSets.map(changeSetPrefix),
  ]);
  const map = recordsFor(pluginDataAdapter);
  const stale = new Set<string>();

  for (const prefix of map.keys()) {
    if ((prefix.startsWith("dslog:snap:") || prefix.startsWith("dslog:cs:")) && !keep.has(prefix)) stale.add(prefix);
  }
  // Also sweep anything an earlier crashed save or session left behind.
  for (const key of await pluginDataAdapter.keys()) {
    const match = PART_INDEX_PATTERN.exec(key);
    if (match) {
      const prefix = key.slice(0, -":index".length);
      if (!keep.has(prefix)) stale.add(prefix);
    }
  }
  if (!manifest.instanceIndex && hadInstances) stale.add(INSTANCES_PREFIX);

  for (const prefix of stale) {
    await deleteChunked(pluginDataAdapter, prefix);
    map.delete(prefix);
  }
}

/**
 * Order matters, and every step is safe to stop after:
 *   1. snapshots, change sets, impact index — new or changed parts only
 *   2. the manifest — the commit point for plugin data; it only ever names parts that already exist
 *   3. clean-up of parts the manifest no longer lists, and of the legacy blob
 *   4. meta (clientStorage) — last, so a failure here leaves older meta pointing at newer, superset data
 * A failure part-way leaves the previous project readable, and nothing is recorded as written until it is.
 */
async function writeProject(project: Project): Promise<void> {
  const started = Date.now();
  const stats: SaveStats = { partsWritten: 0, partsChecked: 0, bytesWritten: 0, ms: 0 };

  for (const baseline of project.baselines) {
    await savePart(pluginDataAdapter, snapshotPrefix(baseline.id), STORAGE_CHUNK_SIZE_PLUGIN_DATA, { source: baseline.snapshot }, stats);
  }
  for (const changeSet of project.changeSets) {
    await savePart(
      pluginDataAdapter,
      changeSetPrefix(changeSet.id),
      STORAGE_CHUNK_SIZE_PLUGIN_DATA,
      { serialize: () => JSON.stringify(changeSet) },
      stats,
    );
  }
  const hadInstances = recordsFor(pluginDataAdapter).has(INSTANCES_PREFIX);
  if (project.instanceIndex) {
    const instanceIndex = project.instanceIndex;
    await savePart(pluginDataAdapter, INSTANCES_PREFIX, STORAGE_CHUNK_SIZE_PLUGIN_DATA, { serialize: () => JSON.stringify(instanceIndex) }, stats);
  }

  const manifest: Manifest = {
    layout: 2,
    snapshots: project.baselines.map((b) => b.id),
    changeSets: project.changeSets.map((cs) => cs.id),
    instanceIndex: project.instanceIndex !== undefined,
  };
  const manifestChanged = await savePart(
    pluginDataAdapter,
    MANIFEST_PREFIX,
    STORAGE_CHUNK_SIZE_PLUGIN_DATA,
    { serialize: () => JSON.stringify(manifest) },
    stats,
  );

  if (manifestChanged) {
    try {
      await removeUnlistedParts(manifest, hadInstances);
      if ((await pluginDataAdapter.get(`${LEGACY_HEAVY_PREFIX}:index`)) !== undefined) {
        await deleteChunked(pluginDataAdapter, LEGACY_HEAVY_PREFIX);
      }
    } catch {
      // The project is already safely saved; leftovers are swept by the next save that changes the manifest.
    }
  }

  const meta: StoredMeta = {
    schemaVersion: project.schemaVersion,
    currentBaselineId: project.currentBaselineId,
    baselines: project.baselines.map(({ snapshot: _snapshot, ...rest }) => rest),
    releases: project.releases,
    trackedEntities: project.trackedEntities,
    settings: project.settings,
  };
  await savePart(clientStorageAdapter, META_PREFIX, STORAGE_CHUNK_SIZE_CLIENT, { serialize: () => JSON.stringify(meta) }, stats);

  stats.ms = Date.now() - started;
  saveLogger?.(stats);
}
