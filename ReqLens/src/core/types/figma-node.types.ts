/**
 * Structural subset of Figma's SceneNode that the analysis engine depends on.
 * Deliberately decoupled from @figma/plugin-typings so analyzers are pure
 * TypeScript, runnable and unit-testable outside the Figma sandbox. Real
 * SceneNode objects satisfy this shape structurally, so no adapter/mapping
 * step is needed when analyzers run in the plugin's main thread.
 */
export type NodeKind =
  | 'FRAME'
  | 'GROUP'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'TEXT'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'VECTOR'
  | 'LINE'
  | 'STAR'
  | 'POLYGON'
  | 'BOOLEAN_OPERATION'
  | 'SLICE'
  | 'STICKY'
  | 'CONNECTOR'
  | 'SECTION'
  | 'OTHER';

export interface AnalyzableNode {
  readonly id: string;
  readonly name: string;
  readonly type: NodeKind;
  readonly visible: boolean;
  readonly width: number;
  readonly height: number;
  /** Text content, present on TEXT nodes. */
  readonly characters?: string;
  /** Resolved main component name, present on INSTANCE nodes when resolvable. */
  readonly mainComponentName?: string;
  readonly opacity?: number;
  readonly locked?: boolean;
  readonly children?: readonly AnalyzableNode[];
}

/** Lightweight, JSON-serializable summary of a selected frame for the UI's overview panel. */
export interface FrameSummary {
  frameId: string;
  frameName: string;
  width: number;
  height: number;
  nodeCount: number;
  /** True when the layer walk hit the safety cap (see analysis.service.ts). */
  truncated: boolean;
  topLevelChildNames: string[];
}
