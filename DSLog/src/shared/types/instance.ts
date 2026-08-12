/** Caps that keep InstanceIndex storage bounded even on files with thousands of instances. */
export const INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT = 30;
export const INSTANCE_INDEX_MAX_SAMPLE_IDS_PER_COMPONENT = 20;

export interface InstanceIndexEntry {
  componentId: string;
  /** Total instances found across the whole document — never capped. */
  count: number;
  /** Deduped, capped names of the nearest top-level frame/section (or page) containing an instance — the "potentially affected" list (spec §7). */
  containerNames: string[];
  /** Capped sample of actual instance node ids, for "select in canvas" affordances. */
  sampleInstanceIds: string[];
  /** Deduped, capped ids of other components whose own structure contains an instance of this one — the "component contains component" edge (spec §8), found by walking each instance's ancestor chain during the scan. */
  containingComponentIds: string[];
}

export interface InstanceIndex {
  builtAt: string;
  totalInstancesScanned: number;
  totalInstancesSkipped: number;
  byComponentId: Record<string, InstanceIndexEntry>;
}

export interface InstanceScanProgress {
  pagesTotal: number;
  pagesDone: number;
  instancesFound: number;
}
