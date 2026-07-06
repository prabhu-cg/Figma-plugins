import type { AnalyzableNode, NodeKind } from '@core/types/figma-node.types';

let counter = 0;

/** Builds a plain AnalyzableNode for tests, without needing the real Figma runtime. */
export function node(overrides: {
  name: string;
  type: NodeKind;
  id?: string;
  width?: number;
  height?: number;
  characters?: string;
  mainComponentName?: string;
  children?: AnalyzableNode[];
}): AnalyzableNode {
  counter += 1;
  return {
    id: overrides.id ?? `node-${counter}`,
    name: overrides.name,
    type: overrides.type,
    visible: true,
    width: overrides.width ?? 100,
    height: overrides.height ?? 40,
    characters: overrides.characters,
    mainComponentName: overrides.mainComponentName,
    children: overrides.children,
  };
}

export function text(characters: string, overrides: Partial<{ id: string; name: string }> = {}): AnalyzableNode {
  return node({ name: overrides.name ?? characters, type: 'TEXT', characters, id: overrides.id });
}
