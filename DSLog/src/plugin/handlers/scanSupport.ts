import type { Baseline, DesignSystemSnapshot } from "@shared/types/project";
import { discoverComponents, scanComponents, scanTokens } from "@plugin/scanner";
import { postToUi } from "@plugin/utils/postMessage";

export interface ScanSummary {
  componentsScanned: number;
  componentsSkipped: number;
  tokensScanned: number;
  tokensSkipped: number;
  skippedItems: Array<{ id: string; name: string; reason: string }>;
}

/**
 * The id list a baseline was created with is a frozen snapshot; re-scanning
 * that exact list can never discover a node with a genuinely new id (e.g. a
 * component deleted and recreated under the same name — the real-world
 * "rename" case). For scope kinds that are re-discoverable from document
 * state (everything except "selection", which is inherently a one-time,
 * non-reproducible pick), re-run discovery each scan so newly-matching
 * components are picked up — this is what makes both "component added"
 * during a scan and rename-pair detection reachable at all.
 */
export async function resolveComponentIds(baseline: Baseline): Promise<string[]> {
  const tracking = baseline.tracking.components;
  if (tracking.scope === "selection") return tracking.includedIds;
  const discovered = await discoverComponents(tracking.scope, tracking.pageIds);
  return discovered.map((d) => d.id);
}

export async function captureSnapshot(
  componentIds: string[],
  tokenCollectionIds: string[],
  tokensEnabled: boolean,
): Promise<{ snapshot: DesignSystemSnapshot; scanSummary: ScanSummary }> {
  const componentResult = await scanComponents(componentIds, (done, total) => {
    postToUi({
      type: "scan-progress",
      progress: { phase: "components", componentsTotal: total, componentsDone: done, tokensTotal: 0, tokensDone: 0 },
    });
  });

  const tokenResult = tokensEnabled
    ? await scanTokens(tokenCollectionIds, (done, total) => {
        postToUi({
          type: "scan-progress",
          progress: {
            phase: "tokens",
            componentsTotal: componentResult.scanned,
            componentsDone: componentResult.scanned,
            tokensTotal: total,
            tokensDone: done,
          },
        });
      })
    : { tokens: [], collections: [], scanned: 0, skipped: [] };

  postToUi({
    type: "scan-progress",
    progress: {
      phase: "done",
      componentsTotal: componentResult.scanned,
      componentsDone: componentResult.scanned,
      tokensTotal: tokenResult.scanned,
      tokensDone: tokenResult.scanned,
    },
  });

  return {
    snapshot: {
      components: componentResult.components,
      tokens: tokenResult.tokens,
      collections: tokenResult.collections,
    },
    scanSummary: {
      componentsScanned: componentResult.scanned,
      componentsSkipped: componentResult.skipped.length,
      tokensScanned: tokenResult.scanned,
      tokensSkipped: tokenResult.skipped.length,
      skippedItems: [...componentResult.skipped, ...tokenResult.skipped],
    },
  };
}
