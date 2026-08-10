import type { Baseline, Project, Release, Settings } from "./project";
import type { ChangeSet } from "./change";
import type { DiscoveredComponent, ScanProgress, TrackingConfig } from "./scan";

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
      reviewed?: boolean;
      reviewNote?: string;
      migrationNote?: string;
    }
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
  | { type: "error"; message: string };

export interface PluginMessageEnvelope<T> {
  pluginMessage: T;
}
