import { vi } from "vitest";
import type { PluginToUiMessage, UiToPluginMessage } from "@shared/types/messages";

/**
 * Simulates the Figma plugin sandbox globals (figma.*) well enough to load
 * and exercise `@plugin/main` end-to-end without a real Figma runtime.
 * Extracted from the original release-flow integration test so other
 * integration tests (deprecation, rename confirmation, ...) can reuse the
 * same fake document/storage instead of re-deriving it.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface FakeNode {
  id: string;
  name: string;
  type: string;
  parent?: FakeNode;
  children?: FakeNode[];
  visible?: boolean;
  width?: number;
  height?: number;
  cornerRadius?: number;
  fills?: any[];
  strokes?: any[];
  effects?: any[];
  layoutMode?: string;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  itemSpacing?: number;
  key?: string;
  description?: string;
  documentationLinks?: any[];
  remote?: boolean;
  componentPropertyDefinitions?: Record<string, any>;
  variantProperties?: Record<string, string> | null;
}

interface FakeVariable {
  id: string;
  key: string;
  name: string;
  variableCollectionId: string;
  resolvedType: "COLOR" | "FLOAT" | "STRING" | "BOOLEAN";
  scopes: string[];
  description: string;
  remote: boolean;
  valuesByMode: Record<string, any>;
}

interface FakeCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  remote: boolean;
}

const PLUGIN_DATA_LIMIT_BYTES = 100_000;
const encoder = new TextEncoder();

export function createFakeFigma() {
  const nodeMap = new Map<string, FakeNode>();

  function registerNode(node: FakeNode): FakeNode {
    nodeMap.set(node.id, node);
    return node;
  }

  function makeFrame(id: string, name: string, children: FakeNode[] = []): FakeNode {
    const node: FakeNode = {
      id,
      name,
      type: "FRAME",
      visible: true,
      width: 120,
      height: 48,
      cornerRadius: 4,
      fills: [{ type: "SOLID", visible: true, opacity: 1, color: { r: 1, g: 1, b: 1 } }],
      layoutMode: "HORIZONTAL",
      paddingTop: 8,
      paddingRight: 12,
      paddingBottom: 8,
      paddingLeft: 12,
      itemSpacing: 4,
      children,
    };
    registerNode(node);
    for (const child of children) child.parent = node;
    return node;
  }

  function makeText(id: string, name: string): FakeNode {
    const node: FakeNode = { id, name, type: "TEXT", visible: true, width: 60, height: 16, children: [] };
    registerNode(node);
    return node;
  }

  function makeComponent(id: string, name: string, opts: Partial<FakeNode> = {}): FakeNode {
    const label = makeText(`${id}-label`, "Label");
    const body = makeFrame(`${id}-body`, name, [label]);
    const node: FakeNode = {
      ...body,
      id,
      name,
      type: "COMPONENT",
      key: `key-${id}`,
      description: `Fixture component ${name}`,
      remote: false,
      componentPropertyDefinitions: { Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: ["Small", "Medium"] } },
      variantProperties: { Size: "Medium" },
      children: [label],
      ...opts,
    };
    registerNode(node);
    label.parent = node;
    return node;
  }

  function makeComponentSet(id: string, name: string, variantNames: string[]): FakeNode {
    const variants = variantNames.map((variantName, i) =>
      makeComponent(`${id}-v${i}`, `Size=${variantName}`, { variantProperties: { Size: variantName } }),
    );
    const node: FakeNode = {
      id,
      name,
      type: "COMPONENT_SET",
      key: `key-${id}`,
      description: `Fixture component set ${name}`,
      remote: false,
      componentPropertyDefinitions: { Size: { type: "VARIANT", defaultValue: "Medium", variantOptions: variantNames } },
      children: variants,
    };
    registerNode(node);
    for (const v of variants) v.parent = node;
    return node;
  }

  function findAllWithCriteria(root: FakeNode, types: string[]): FakeNode[] {
    const results: FakeNode[] = [];
    function walk(node: FakeNode) {
      for (const child of node.children ?? []) {
        if (types.includes(child.type)) results.push(child);
        walk(child);
      }
    }
    walk(root);
    return results;
  }

  const clientStorageData = new Map<string, string>();
  const pluginData = new Map<string, string>();

  const page: FakeNode = { id: "page-1", name: "Components", type: "PAGE", children: [] };
  registerNode(page);

  const components: FakeNode[] = [];
  for (let i = 0; i < 20; i++) {
    components.push(makeComponent(`comp-${i}`, i === 0 ? "按钮 Button 🔘" : `Component ${i}`));
  }
  const componentSet = makeComponentSet("set-1", "Badge", ["Small", "Medium", "Large"]);
  page.children = [...components, componentSet];
  for (const c of page.children) c.parent = page;

  const collection: FakeCollection = {
    id: "coll-1",
    name: "Primitives",
    modes: [
      { modeId: "mode-light", name: "Light" },
      { modeId: "mode-dark", name: "Dark" },
    ],
    defaultModeId: "mode-light",
    remote: false,
  };

  const variables: FakeVariable[] = Array.from({ length: 40 }, (_, i) => ({
    id: `var-${i}`,
    key: `var-key-${i}`,
    name: i === 0 ? "颜色.文本.主要 🎨" : `spacing.token.${i}`,
    variableCollectionId: "coll-1",
    resolvedType: i % 2 === 0 ? "COLOR" : "FLOAT",
    scopes: ["ALL_FILLS"],
    description: `Fixture token ${i}`,
    remote: false,
    valuesByMode:
      i % 2 === 0
        ? { "mode-light": { r: 0.1, g: 0.2, b: 0.3 }, "mode-dark": { r: 0.9, g: 0.8, b: 0.7 } }
        : { "mode-light": i, "mode-dark": i + 1 },
  }));

  const root = {
    children: [page],
    getPluginData(key: string): string {
      return pluginData.get(key) ?? "";
    },
    setPluginData(key: string, value: string): void {
      const size = encoder.encode(value).length;
      if (size > PLUGIN_DATA_LIMIT_BYTES) {
        throw new Error(`in setPluginData: This pluginData entry exceeds 100 kB per entry limit.`);
      }
      pluginData.set(key, value);
    },
    getPluginDataKeys(): string[] {
      return Array.from(pluginData.keys());
    },
  };

  // Attach directly to the registered `page` node (not a copy) — both
  // figma.root.children and figma.currentPage must reference the same
  // object, since discoverComponents.ts's "document" scope walks
  // figma.root.children and calls .loadAsync()/.findAllWithCriteria() on
  // each page it finds there.
  Object.assign(page, {
    selection: [] as FakeNode[],
    loadAsync: async () => {},
    findAllWithCriteria: (opts: { types: string[] }) => findAllWithCriteria(page, opts.types),
  });

  const fakeFigma: any = {
    root,
    currentPage: page,
    ui: { postMessage: (_msg: unknown) => {} },
    showUI: () => {},
    loadAllPagesAsync: async () => {},
    setCurrentPageAsync: async (p: any) => {
      fakeFigma.currentPage = p;
    },
    getNodeByIdAsync: async (id: string) => nodeMap.get(id) ?? null,
    viewport: { scrollAndZoomIntoView: () => {} },
    clientStorage: {
      getAsync: async (key: string) => clientStorageData.get(key),
      setAsync: async (key: string, value: string) => {
        clientStorageData.set(key, value);
      },
      deleteAsync: async (key: string) => {
        clientStorageData.delete(key);
      },
      keysAsync: async () => Array.from(clientStorageData.keys()),
    },
    variables: {
      getLocalVariableCollectionsAsync: async () => [collection],
      getLocalVariablesAsync: async () => variables,
    },
  };

  return { fakeFigma, page, components, componentSet, pluginData, clientStorageData, nodeMap, registerNode };
}

export async function loadMainWithFakeFigma() {
  const { fakeFigma, page, components, componentSet, pluginData, clientStorageData, nodeMap } = createFakeFigma();
  (globalThis as any).figma = fakeFigma;
  (globalThis as any).__html__ = "";

  const received: PluginToUiMessage[] = [];
  fakeFigma.ui.postMessage = (msg: PluginToUiMessage) => received.push(msg);

  // main.ts holds module-level `project` state; reset the module registry
  // before each import so multiple calls within one test file (or across
  // files) don't leak state into each other.
  vi.resetModules();
  await import("@plugin/main");

  const send = async (message: UiToPluginMessage) => {
    received.length = 0;
    await fakeFigma.ui.onmessage(message);
    // message handling is async; onmessage itself awaits internally via a
    // .catch()-wrapped promise, so give microtasks a chance to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));
    return received;
  };

  return { send, page, components, componentSet, pluginData, clientStorageData, nodeMap };
}
