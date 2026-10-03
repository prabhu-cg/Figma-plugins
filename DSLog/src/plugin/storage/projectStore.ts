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
import { readChunked, writeChunked } from "./chunking";

const META_PREFIX = "dslog:meta";
const HEAVY_PREFIX = "dslog:heavy";

type BaselineWithoutSnapshot = Omit<Baseline, "snapshot">;

interface StoredMeta {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: BaselineWithoutSnapshot[];
  releases: Project["releases"];
  trackedEntities: TrackedEntity[];
  settings: Settings;
}

interface HeavyData {
  snapshots: Record<string, DesignSystemSnapshot>;
  changeSets: ChangeSet[];
  /** Can be large (thousands of instances) — heavy storage, not the compact meta chunk. */
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

function isHeavyData(value: unknown): value is HeavyData {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.snapshots === "object" && v.snapshots !== null && Array.isArray(v.changeSets);
}

const EMPTY_SNAPSHOT: DesignSystemSnapshot = { components: [], tokens: [], collections: [] };

export async function loadProject(): Promise<Project> {
  const metaRaw = await readChunked<unknown>(clientStorageAdapter, META_PREFIX);
  const heavyRaw = await readChunked<unknown>(pluginDataAdapter, HEAVY_PREFIX);

  if (!isStoredMeta(metaRaw)) {
    return createEmptyProject(STORAGE_SCHEMA_VERSION);
  }

  const heavy = isHeavyData(heavyRaw) ? heavyRaw : { snapshots: {}, changeSets: [] };

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

let saveTail: Promise<void> = Promise.resolve();

/**
 * Saves are serialised: `heavy` and `meta` are two blobs that must be written in a fixed order (see below),
 * and two overlapping saves would interleave those writes. Each save serialises the project when it actually
 * runs, so a queued save always stores the newest state.
 */
export function saveProject(project: Project): Promise<void> {
  const run = saveTail.catch(() => undefined).then(() => writeProject(project));
  saveTail = run.catch(() => undefined);
  return run;
}

async function writeProject(project: Project): Promise<void> {
  const snapshots: Record<string, DesignSystemSnapshot> = {};
  const baselinesWithoutSnapshot: BaselineWithoutSnapshot[] = project.baselines.map((baseline) => {
    snapshots[baseline.id] = baseline.snapshot;
    const { snapshot: _snapshot, ...rest } = baseline;
    return rest;
  });

  const meta: StoredMeta = {
    schemaVersion: project.schemaVersion,
    currentBaselineId: project.currentBaselineId,
    baselines: baselinesWithoutSnapshot,
    releases: project.releases,
    trackedEntities: project.trackedEntities,
    settings: project.settings,
  };

  const heavy: HeavyData = {
    snapshots,
    changeSets: project.changeSets,
    instanceIndex: project.instanceIndex,
  };

  // Sequential, heavy first. If the heavy write fails nothing has changed. If the
  // meta write fails after it, the stored meta (older) still resolves against the
  // stored heavy data (newer), because heavy holds a superset of the snapshots meta
  // references — so no baseline ever loads with a missing snapshot. Writing them in
  // parallel could leave either store ahead of the other with no safe ordering.
  await writeChunked(pluginDataAdapter, HEAVY_PREFIX, heavy, STORAGE_CHUNK_SIZE_PLUGIN_DATA);
  await writeChunked(clientStorageAdapter, META_PREFIX, meta, STORAGE_CHUNK_SIZE_CLIENT);
}
