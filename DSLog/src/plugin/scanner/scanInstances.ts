import type { InstanceIndex, InstanceIndexEntry, InstanceScanProgress } from "@shared/types/instance";
import {
  INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT,
  INSTANCE_INDEX_MAX_SAMPLE_IDS_PER_COMPONENT,
} from "@shared/types/instance";
import { SCAN_BATCH_SIZE } from "@shared/constants/storage";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Walks up from an instance to the nearest node whose direct parent is the
 * page — the "screen"/frame a viewer would actually recognize — for the
 * "potentially affected" list (spec §7). Falls back to the instance's own
 * name if it sits directly on the page.
 */
function findContainerName(node: any): string {
  let current = node;
  while (current.parent && current.parent.type !== "PAGE") {
    current = current.parent;
  }
  return current.name;
}

/**
 * Walks up from an instance (not including itself) to the nearest COMPONENT
 * ancestor, if any — a purely synchronous check (just `.parent`/`.type`,
 * no extra `getMainComponentAsync` calls) that gives "component X contains
 * an instance of component Y" edges (spec §8) for free during this same
 * document walk, without touching the synchronous normalizeComponent
 * pipeline used on every regular scan.
 */
function findContainingComponentId(node: any): string | undefined {
  let current = node.parent;
  while (current && current.type !== "PAGE") {
    if (current.type === "COMPONENT") return current.id;
    current = current.parent;
  }
  return undefined;
}

interface MutableEntry extends InstanceIndexEntry {
  containerNameSet: Set<string>;
  containingComponentIdSet: Set<string>;
}

/**
 * Document-wide instance scan: for every INSTANCE node in the file, resolves
 * its main component (via `getMainComponentAsync`, required for correctness
 * under `documentAccess: "dynamic-page"` — the sync `mainComponent` getter
 * is write-only in that mode) and aggregates counts per component. This is
 * a real full-document walk, so unlike the regular component/token scan it
 * is never run implicitly — only from an explicit "Build impact index"
 * action (spec §19: don't repeatedly scan the whole document).
 */
export async function scanInstances(onProgress?: (progress: InstanceScanProgress) => void): Promise<InstanceIndex> {
  await figma.loadAllPagesAsync();
  const pages = figma.root.children;

  const byComponentId = new Map<string, MutableEntry>();
  let totalScanned = 0;
  let totalSkipped = 0;
  let instancesFound = 0;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pages[pageIndex] as any;
    await page.loadAsync();
    const instances: any[] = page.findAllWithCriteria({ types: ["INSTANCE"] });
    instancesFound += instances.length;
    onProgress?.({ pagesTotal: pages.length, pagesDone: pageIndex, instancesFound });

    for (let i = 0; i < instances.length; i += SCAN_BATCH_SIZE) {
      const batch = instances.slice(i, i + SCAN_BATCH_SIZE);
      await Promise.all(
        batch.map(async (instance) => {
          try {
            const main = await instance.getMainComponentAsync();
            if (!main) {
              totalSkipped += 1;
              return;
            }
            let entry = byComponentId.get(main.id);
            if (!entry) {
              entry = {
                componentId: main.id,
                count: 0,
                containerNames: [],
                sampleInstanceIds: [],
                containingComponentIds: [],
                containerNameSet: new Set(),
                containingComponentIdSet: new Set(),
              };
              byComponentId.set(main.id, entry);
            }
            entry.count += 1;

            const containerName = findContainerName(instance);
            if (
              entry.containerNameSet.size < INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT &&
              !entry.containerNameSet.has(containerName)
            ) {
              entry.containerNameSet.add(containerName);
              entry.containerNames.push(containerName);
            }
            if (entry.sampleInstanceIds.length < INSTANCE_INDEX_MAX_SAMPLE_IDS_PER_COMPONENT) {
              entry.sampleInstanceIds.push(instance.id);
            }

            const containingComponentId = findContainingComponentId(instance);
            if (
              containingComponentId &&
              entry.containingComponentIdSet.size < INSTANCE_INDEX_MAX_CONTAINERS_PER_COMPONENT &&
              !entry.containingComponentIdSet.has(containingComponentId)
            ) {
              entry.containingComponentIdSet.add(containingComponentId);
              entry.containingComponentIds.push(containingComponentId);
            }

            totalScanned += 1;
          } catch {
            totalSkipped += 1;
          }
        }),
      );
    }

    onProgress?.({ pagesTotal: pages.length, pagesDone: pageIndex + 1, instancesFound });
  }

  const byComponentIdResult: InstanceIndex["byComponentId"] = {};
  for (const [id, entry] of byComponentId) {
    byComponentIdResult[id] = {
      componentId: entry.componentId,
      count: entry.count,
      containerNames: entry.containerNames,
      sampleInstanceIds: entry.sampleInstanceIds,
      containingComponentIds: entry.containingComponentIds,
    };
  }

  return {
    builtAt: new Date().toISOString(),
    totalInstancesScanned: totalScanned,
    totalInstancesSkipped: totalSkipped,
    byComponentId: byComponentIdResult,
  };
}
