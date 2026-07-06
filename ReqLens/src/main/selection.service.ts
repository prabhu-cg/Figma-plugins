import type { AnalyzableNode, FrameSummary, NodeKind } from '@core/types/figma-node.types';

/** Safety cap so a single pathological frame (10k+ layers) can't blow the analysis time/memory budget. */
export const MAX_NODES_PER_FRAME = 10_000;

/** Node types the user is expected to select as an analyzable "screen". */
const FRAME_LIKE_TYPES = new Set<string>(['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION']);

const KNOWN_NODE_KINDS: ReadonlySet<string> = new Set<NodeKind>([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'TEXT',
  'RECTANGLE',
  'ELLIPSE',
  'VECTOR',
  'LINE',
  'STAR',
  'POLYGON',
  'BOOLEAN_OPERATION',
  'SLICE',
  'STICKY',
  'CONNECTOR',
  'SECTION',
]);

function toNodeKind(type: string): NodeKind {
  return KNOWN_NODE_KINDS.has(type) ? (type as NodeKind) : 'OTHER';
}

async function resolveMainComponentName(node: SceneNode): Promise<string | undefined> {
  if (node.type !== 'INSTANCE') return undefined;
  try {
    const main = await node.getMainComponentAsync();
    return main?.name;
  } catch {
    return undefined;
  }
}

interface WalkBudget {
  remaining: number;
  truncated: boolean;
}

async function walkNode(node: SceneNode, budget: WalkBudget): Promise<AnalyzableNode> {
  budget.remaining -= 1;

  const mainComponentName = await resolveMainComponentName(node);
  const base: AnalyzableNode = {
    id: node.id,
    name: node.name,
    type: toNodeKind(node.type),
    visible: node.visible,
    width: 'width' in node ? node.width : 0,
    height: 'height' in node ? node.height : 0,
    characters: node.type === 'TEXT' ? node.characters : undefined,
    mainComponentName,
    opacity: 'opacity' in node ? (node.opacity ?? undefined) : undefined,
    locked: 'locked' in node ? node.locked : undefined,
  };

  if (!('children' in node)) return base;

  const children: AnalyzableNode[] = [];
  for (const child of node.children) {
    if (budget.remaining <= 0) {
      budget.truncated = true;
      break;
    }
    children.push(await walkNode(child as SceneNode, budget));
  }
  return { ...base, children };
}

export interface SelectedFrame {
  frameId: string;
  frameName: string;
  root: AnalyzableNode;
  summary: FrameSummary;
}

async function serializeSelectedFrame(node: SceneNode): Promise<SelectedFrame> {
  const budget: WalkBudget = { remaining: MAX_NODES_PER_FRAME, truncated: false };
  const root = await walkNode(node, budget);
  const nodeCount = MAX_NODES_PER_FRAME - budget.remaining;
  const topLevelChildNames = (root.children ?? []).slice(0, 20).map((child) => child.name);

  return {
    frameId: node.id,
    frameName: node.name,
    root,
    summary: {
      frameId: node.id,
      frameName: node.name,
      width: 'width' in node ? node.width : 0,
      height: 'height' in node ? node.height : 0,
      nodeCount,
      truncated: budget.truncated,
      topLevelChildNames,
    },
  };
}

/** The subset of the current selection the plugin can analyze (frames, components, instances, sections). */
export function getAnalyzableSelection(): SceneNode[] {
  return figma.currentPage.selection.filter((node) => FRAME_LIKE_TYPES.has(node.type));
}

export async function serializeSelection(nodes: readonly SceneNode[]): Promise<SelectedFrame[]> {
  const results: SelectedFrame[] = [];
  for (const node of nodes) {
    results.push(await serializeSelectedFrame(node));
  }
  return results;
}
