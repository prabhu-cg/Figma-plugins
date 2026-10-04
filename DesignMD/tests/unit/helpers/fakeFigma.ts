/**
 * A small in-memory stand-in for the Figma Plugin API — just the surface DesignMD's extraction
 * layer and plugin controller touch. Build a document with the node helpers, call
 * `installFakeFigma(...)` to expose it as the global `figma`, then run the real extraction code.
 *
 * Deliberately typed loosely: the point is to exercise our code against realistic API *shapes*
 * (async getters, `figma.mixed` symbols, throwing accessors), not to re-implement Figma.
 */
import { vi } from 'vitest';

type Props = Record<string, unknown>;

export interface FakeNode extends Props {
  id: string;
  name: string;
  type: string;
  parent: FakeNode | null;
  children?: FakeNode[];
}

let nextId = 1;
const newId = (prefix: string) => `${prefix}:${nextId++}`;

/** Reset id counters so each test sees predictable ids. */
export function resetFakeIds(): void {
  nextId = 1;
}

export function node(
  type: string,
  name: string,
  props: Props = {},
  children?: FakeNode[],
): FakeNode {
  const n: FakeNode = {
    appendChild(child: FakeNode) {
      child.parent?.children?.splice(child.parent.children.indexOf(child), 1);
      (n.children ??= []).push(child);
      child.parent = n;
    },
    remove() {
      const siblings = n.parent?.children;
      if (siblings) siblings.splice(siblings.indexOf(n), 1);
      n.parent = null;
    },
    resize(width: number, height: number) {
      n.width = width;
      n.height = height;
    },
    id: (props.id as string | undefined) ?? newId(type.toLowerCase()),
    name,
    type,
    parent: null,
    ...props,
  };
  if (children) {
    n.children = children;
    for (const child of children) child.parent = n;
    // Containers (frames, pages, the document) can search their descendants, like the real API.
    n.findAllWithCriteria = ({ types }: { types: string[] }) => {
      const found: FakeNode[] = [];
      const walk = (parent: FakeNode) => {
        for (const child of parent.children ?? []) {
          if (types.includes(child.type)) found.push(child);
          walk(child);
        }
      };
      walk(n);
      return found;
    };
  }
  return n;
}

export const frame = (name: string, children: FakeNode[] = [], props: Props = {}) =>
  node('FRAME', name, props, children);

export const page = (name: string, children: FakeNode[] = [], props: Props = {}) =>
  node('PAGE', name, props, children);

export const component = (name: string, props: Props = {}, children: FakeNode[] = []) =>
  node('COMPONENT', name, { description: '', key: `key-${name}`, ...props }, children);

/** A component set; `variants` become its COMPONENT children, named like Figma ("Size=Large, State=Hover"). */
export function componentSet(
  name: string,
  variants: Array<{ props: Record<string, string>; children?: FakeNode[]; extra?: Props }>,
  props: Props = {},
): FakeNode {
  const children = variants.map((v) =>
    component(
      Object.entries(v.props)
        .map(([k, val]) => `${k}=${val}`)
        .join(', '),
      { variantProperties: v.props, ...v.extra },
      v.children ?? [],
    ),
  );
  return node('COMPONENT_SET', name, { description: '', key: `key-${name}`, ...props }, children);
}

export const alias = (id: string) => ({ type: 'VARIABLE_ALIAS', id });

export const document = (name: string, pages: FakeNode[]): FakeNode =>
  node('DOCUMENT', name, {}, pages);

export interface FakeVariableCollection {
  id: string;
  name: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  variableIds: string[];
  hiddenFromPublishing?: boolean;
}

export interface FakeVariable {
  id: string;
  name: string;
  variableCollectionId: string;
  resolvedType: 'COLOR' | 'FLOAT' | 'STRING' | 'BOOLEAN';
  description?: string;
  scopes?: string[];
  codeSyntax?: Record<string, string>;
  valuesByMode: Record<string, unknown>;
  hiddenFromPublishing?: boolean;
}

export interface FakeFigmaOptions {
  root?: FakeNode;
  collections?: FakeVariableCollection[];
  variables?: FakeVariable[];
  /** Nodes returned by figma.currentPage.selection. */
  selection?: FakeNode[];
  /** Initial figma.clientStorage contents. */
  storage?: Record<string, unknown>;
  textStyles?: Props[];
  paintStyles?: Props[];
  effectStyles?: Props[];
  gridStyles?: Props[];
  /** Make specific API calls reject, to exercise warning paths. */
  failures?: {
    loadAllPages?: boolean;
    findAll?: boolean;
    collections?: boolean;
    variableIds?: string[];
    textStyles?: boolean;
    paintStyles?: boolean;
    effectStyles?: boolean;
    gridStyles?: boolean;
    storageRead?: boolean;
    storageWrite?: boolean;
  };
}

export interface FakeFigmaHandle {
  figma: Props;
  /** Messages posted via figma.ui.postMessage, in order. */
  posted: unknown[];
  calls: { loadAllPages: number; variableLookups: string[] };
  /** figma.clientStorage contents (mutated by setAsync). */
  storage: Record<string, unknown>;
  /** Selection that figma.currentPage.selection returns; reassign then call `emit`. */
  setSelection: (nodes: FakeNode[]) => void;
  /** Fire a figma.on(...) event, e.g. 'selectionchange'. */
  emit: (event: string) => void;
  /** Deliver a UI -> plugin message to the controller registered on figma.ui.onmessage. */
  send: (message: unknown) => Promise<void>;
}

const reject = (what: string) => Promise.reject(new Error(`${what} failed`));

/** Installs a fake global `figma` (and `__html__`); undone by `vi.unstubAllGlobals()`. */
export function installFakeFigma(options: FakeFigmaOptions = {}): FakeFigmaHandle {
  const failures = options.failures ?? {};
  const root = options.root ?? document('Untitled', [page('Page 1')]);
  const variablesById = new Map((options.variables ?? []).map((v) => [v.id, v]));
  const posted: unknown[] = [];
  const calls = { loadAllPages: 0, variableLookups: [] as string[] };
  const storage = { ...(options.storage ?? {}) };
  const currentPage = page('Page 1', []);
  currentPage.selection = options.selection ?? [];
  const listeners = new Map<string, Array<() => void>>();

  const figma: Props & { ui: Props } = {
    root,
    mixed: Symbol('figma.mixed'),
    showUI: vi.fn(),
    currentPage,
    createPage: () => {
      const created = page('Page', []);
      created.selection = [];
      root.appendChild(created);
      return created;
    },
    createFrame: () => frame('Frame'),
    createRectangle: () => node('RECTANGLE', 'Rectangle'),
    createComponent: () => component('Component'),
    combineAsVariants: (variants: FakeNode[], parent: FakeNode) => {
      const set = node('COMPONENT_SET', 'Component set', { description: '', key: 'set-key' }, []);
      for (const variant of variants) {
        variant.variantProperties = Object.fromEntries(
          variant.name.split(',').map((pair) => pair.trim().split('=') as [string, string]),
        );
        set.appendChild(variant);
      }
      parent.appendChild(set);
      return set;
    },
    setCurrentPageAsync: (next: FakeNode) => {
      figma.currentPage = next;
      return Promise.resolve();
    },
    on: (event: string, handler: () => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    clientStorage: {
      getAsync: (key: string) =>
        failures.storageRead ? reject('clientStorage.getAsync') : Promise.resolve(storage[key]),
      setAsync: (key: string, value: unknown) => {
        if (failures.storageWrite) return reject('clientStorage.setAsync');
        storage[key] = value;
        return Promise.resolve();
      },
    },
    ui: {
      postMessage: (message: unknown) => posted.push(message),
      onmessage: undefined,
    },
    loadAllPagesAsync: () => {
      calls.loadAllPages++;
      return failures.loadAllPages ? reject('loadAllPagesAsync') : Promise.resolve();
    },
    variables: {
      getLocalVariableCollectionsAsync: () =>
        failures.collections
          ? reject('getLocalVariableCollectionsAsync')
          : Promise.resolve(options.collections ?? []),
      getVariableByIdAsync: (id: string) => {
        calls.variableLookups.push(id);
        if (failures.variableIds?.includes(id)) return reject(`getVariableByIdAsync(${id})`);
        return Promise.resolve(variablesById.get(id) ?? null);
      },
    },
    getLocalTextStylesAsync: () =>
      failures.textStyles
        ? reject('getLocalTextStylesAsync')
        : Promise.resolve(options.textStyles ?? []),
    getLocalPaintStylesAsync: () =>
      failures.paintStyles
        ? reject('getLocalPaintStylesAsync')
        : Promise.resolve(options.paintStyles ?? []),
    getLocalEffectStylesAsync: () =>
      failures.effectStyles
        ? reject('getLocalEffectStylesAsync')
        : Promise.resolve(options.effectStyles ?? []),
    getLocalGridStylesAsync: () =>
      failures.gridStyles
        ? reject('getLocalGridStylesAsync')
        : Promise.resolve(options.gridStyles ?? []),
  };

  if (failures.findAll) {
    root.findAllWithCriteria = () => {
      throw new Error('findAllWithCriteria failed');
    };
  }

  vi.stubGlobal('figma', figma);
  vi.stubGlobal('__html__', '<html></html>');

  return {
    figma,
    posted,
    calls,
    storage,
    setSelection: (nodes) => {
      (figma.currentPage as FakeNode).selection = nodes;
    },
    emit: (event) => listeners.get(event)?.forEach((handler) => handler()),
    send: async (message) => {
      const handler = figma.ui.onmessage as ((m: unknown) => Promise<void> | void) | undefined;
      if (!handler) throw new Error('No figma.ui.onmessage handler registered');
      await handler(message);
    },
  };
}

// ---- Value builders --------------------------------------------------------------------------

export function fakeCollection(
  overrides: Partial<FakeVariableCollection> = {},
): FakeVariableCollection {
  return {
    id: 'VariableCollectionId:1',
    name: 'Colors',
    modes: [
      { modeId: 'm:light', name: 'Light' },
      { modeId: 'm:dark', name: 'Dark' },
    ],
    defaultModeId: 'm:light',
    variableIds: [],
    ...overrides,
  };
}

export function fakeVariable(overrides: Partial<FakeVariable> = {}): FakeVariable {
  return {
    id: 'VariableID:1',
    name: 'Color/Primary',
    variableCollectionId: 'VariableCollectionId:1',
    resolvedType: 'COLOR',
    valuesByMode: { 'm:light': { r: 1, g: 0, b: 0, a: 1 } },
    ...overrides,
  };
}

export function fakeTextStyle(overrides: Props = {}): Props {
  return {
    id: 'S:text:1',
    name: 'Heading/Large',
    description: '',
    fontName: { family: 'Inter', style: 'Bold' },
    fontSize: 32,
    lineHeight: { unit: 'PERCENT', value: 120 },
    letterSpacing: { unit: 'PIXELS', value: 0 },
    textCase: 'ORIGINAL',
    textDecoration: 'NONE',
    paragraphSpacing: 0,
    boundVariables: {},
    ...overrides,
  };
}

export function fakePaintStyle(overrides: Props = {}): Props {
  return {
    id: 'S:paint:1',
    name: 'Surface/Background',
    description: '',
    paints: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }],
    boundVariables: {},
    ...overrides,
  };
}

export function fakeEffectStyle(overrides: Props = {}): Props {
  return {
    id: 'S:effect:1',
    name: 'Elevation/Card',
    description: '',
    effects: [
      {
        type: 'DROP_SHADOW',
        visible: true,
        color: { r: 0, g: 0, b: 0, a: 0.2 },
        offset: { x: 0, y: 2 },
        radius: 8,
        spread: 1,
      },
    ],
    boundVariables: {},
    ...overrides,
  };
}

export function fakeGridStyle(overrides: Props = {}): Props {
  return {
    id: 'S:grid:1',
    name: 'Layout/12col',
    description: '',
    layoutGrids: [
      { pattern: 'COLUMNS', count: 12, gutterSize: 16, offset: 24, alignment: 'STRETCH' },
    ],
    ...overrides,
  };
}
