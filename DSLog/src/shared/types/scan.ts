export type ComponentScanScope =
  | "selection"
  | "current-page"
  | "selected-pages"
  | "document";

export interface ComponentTrackingConfig {
  scope: ComponentScanScope;
  /** Node ids explicitly included (used with "selection" and to allow exclusions). */
  includedIds: string[];
  /** Page ids to scan, used with "selected-pages". */
  pageIds: string[];
}

export interface TokenTrackingConfig {
  enabled: boolean;
  /** Empty = all collections. */
  includedCollectionIds: string[];
}

export interface TrackingConfig {
  components: ComponentTrackingConfig;
  tokens: TokenTrackingConfig;
}

export interface DiscoveredComponent {
  id: string;
  name: string;
  componentSetName?: string;
  pageId: string;
  pageName: string;
}

export interface ScanProgress {
  phase: "components" | "tokens" | "done";
  componentsTotal: number;
  componentsDone: number;
  tokensTotal: number;
  tokensDone: number;
}
