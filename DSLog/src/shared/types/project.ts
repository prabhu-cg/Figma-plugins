import type { ComponentSnapshot } from "./component";
import type { TokenSnapshot, VariableCollectionSnapshot } from "./token";
import type { TrackingConfig } from "./scan";
import type { ChangeSet } from "./change";
import type { TrackedEntity } from "./entity";
import type { InstanceIndex } from "./instance";

export interface DesignSystemSnapshot {
  components: ComponentSnapshot[];
  tokens: TokenSnapshot[];
  collections: VariableCollectionSnapshot[];
}

export interface Baseline {
  id: string;
  name: string;
  version: string;
  description?: string;
  tracking: TrackingConfig;
  snapshot: DesignSystemSnapshot;
  createdAt: string;
}

export interface Release {
  id: string;
  version: string;
  title: string;
  description?: string;
  baselineId: string;
  /** Baseline this release supersedes and becomes the new "current" baseline going forward. */
  previousBaselineId?: string;
  changeSetId: string;
  include: {
    components: boolean;
    tokens: boolean;
    breakingChanges: boolean;
    migrationNotes: boolean;
  };
  changelogMarkdown: string;
  changelogJson: string;
  createdAt: string;
}

export interface Settings {
  tracking: {
    components: boolean;
    tokens: boolean;
  };
  detection: {
    structural: boolean;
    tokens: boolean;
    properties: boolean;
    styles: boolean;
  };
}

export const DEFAULT_SETTINGS: Settings = {
  tracking: { components: true, tokens: true },
  detection: { structural: true, tokens: true, properties: true, styles: true },
};

export interface Project {
  schemaVersion: number;
  currentBaselineId?: string;
  baselines: Baseline[];
  releases: Release[];
  changeSets: ChangeSet[];
  trackedEntities: TrackedEntity[];
  /** Document-wide instance usage, built only by an explicit "Build impact index" action (spec §19). */
  instanceIndex?: InstanceIndex;
  settings: Settings;
}

export function createEmptyProject(schemaVersion: number): Project {
  return {
    schemaVersion,
    baselines: [],
    releases: [],
    changeSets: [],
    trackedEntities: [],
    settings: DEFAULT_SETTINGS,
  };
}
