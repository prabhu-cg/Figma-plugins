import type { Baseline, Project, Release, Settings } from "./project";
import type { ChangeSet, ManualClassification } from "./change";
import type { DiscoveredComponent, ScanProgress, TrackingConfig } from "./scan";
import type { EntityKind, ReviewState } from "./entity";
import type { InstanceIndex, InstanceScanProgress } from "./instance";

export type UiToPluginMessage =
  | { type: "ui-ready" }
  | { type: "get-state" }
  | { type: "discover-components"; scope: TrackingConfig["components"]["scope"]; pageIds: string[] }
  | {
      type: "create-baseline";
      name: string;
      version: string;
      description?: string;
      tracking: TrackingConfig;
    }
  | { type: "scan" }
  | {
      type: "create-release";
      version: string;
      title: string;
      description?: string;
      include: Release["include"];
    }
  | { type: "export"; format: "markdown" | "json"; releaseId: string }
  | {
      type: "update-change";
      changeSetId: string;
      changeId: string;
      reviewState?: ReviewState;
      reviewNote?: string;
      migrationNote?: string;
      manualClassification?: ManualClassification | null;
    }
  | {
      type: "bulk-update-review";
      changeSetId: string;
      changeIds: string[];
      reviewState: ReviewState;
    }
  | {
      type: "mark-deprecated";
      entityId: string;
      kind: EntityKind;
      parentId?: string;
      displayName: string;
      replacement?: string;
      migrationNote?: string;
    }
  | { type: "unmark-deprecated"; entityId: string }
  | { type: "confirm-rename"; changeSetId: string; addedChangeId: string; removedChangeId: string }
  | { type: "dismiss-rename"; changeSetId: string; addedChangeId: string; removedChangeId: string }
  | { type: "build-impact-index" }
  | { type: "compare-releases"; releaseIdA: string; releaseIdB: string }
  | { type: "update-settings"; settings: Settings }
  | { type: "focus-node"; nodeId: string };

export type PluginToUiMessage =
  | { type: "state"; project: Project }
  | { type: "discovered-components"; components: DiscoveredComponent[] }
  | { type: "scan-progress"; progress: ScanProgress }
  | { type: "scan-complete"; changeSet: ChangeSet }
  | { type: "baseline-created"; baseline: Baseline }
  | { type: "release-created"; release: Release }
  | { type: "export-result"; format: "markdown" | "json"; content: string; releaseId: string }
  | { type: "impact-index-progress"; progress: InstanceScanProgress }
  | { type: "impact-index-complete"; index: InstanceIndex }
  | { type: "release-comparison-result"; releaseIdA: string; releaseIdB: string; changeSet: ChangeSet }
  | { type: "error"; message: string };

export interface PluginMessageEnvelope<T> {
  pluginMessage: T;
}
