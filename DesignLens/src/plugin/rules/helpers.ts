import type { NodeRef } from "@shared/types";
import type { ComponentRecord } from "./types";

export function findOwningPage(node: BaseNode): PageNode | null {
  let current: BaseNode | null = node;
  while (current) {
    if (current.type === "PAGE") return current as PageNode;
    current = current.parent;
  }
  return null;
}

export function toNodeRef(node: SceneNode, componentId?: string, componentName?: string): NodeRef {
  const page = findOwningPage(node);
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    pageId: page?.id ?? "",
    pageName: page?.name ?? "",
    componentId,
    componentName
  };
}

export function componentRef(record: ComponentRecord): NodeRef {
  return toNodeRef(record.node, record.info.id, record.info.name);
}

const ownNodeCache = new WeakMap<SceneNode, SceneNode[]>();

/**
 * The root plus every descendant a component author can actually edit. Instances are included
 * but not entered (their internals belong to the main component), and nested components are
 * skipped too (they're audited as their own record). Cached per root so ~15 rules don't each
 * re-walk the tree.
 */
export function ownNodes(root: SceneNode): SceneNode[] {
  const cached = ownNodeCache.get(root);
  if (cached) return cached;
  const result: SceneNode[] = [];
  const stack: SceneNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop() as SceneNode;
    result.push(node);
    if (node !== root && (node.type === "INSTANCE" || node.type === "COMPONENT" || node.type === "COMPONENT_SET")) continue;
    if ("children" in node) {
      const children = (node as ChildrenMixin).children as readonly SceneNode[];
      for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
    }
  }
  ownNodeCache.set(root, result);
  return result;
}

/** Descendants of `root` (excluding root itself) matching `predicate`, per ownNodes(). */
export function findOwn<T extends SceneNode = SceneNode>(root: SceneNode, predicate: (node: SceneNode) => boolean): T[] {
  return ownNodes(root).filter((n) => n !== root && predicate(n)) as T[];
}

/** True if the node or any ancestor is hidden. */
export function isHiddenInTree(node: BaseNode): boolean {
  let current: BaseNode | null = node;
  while (current && current.type !== "PAGE" && current.type !== "DOCUMENT") {
    if ("visible" in current && (current as SceneNode).visible === false) return true;
    current = current.parent;
  }
  return false;
}

/** True if an ancestor of `node` below `root` has "icon" in its name (so the node is part of an icon). */
export function hasIconAncestor(node: SceneNode, root: SceneNode): boolean {
  let current: BaseNode | null = node.parent;
  while (current && current !== root) {
    if (current.name.toLowerCase().includes("icon")) return true;
    current = current.parent;
  }
  return false;
}

function paintHasVariable(paintLike: unknown): boolean {
  const bound = (paintLike as { boundVariables?: Record<string, unknown> } | undefined)?.boundVariables;
  return !!bound && Object.values(bound).some((v) => v !== undefined && v !== null);
}

/**
 * Whether a property is driven by a variable. Checks the node-level boundVariables entry and,
 * for fills/strokes/effects, the paint/effect's own boundVariables (where color bindings live).
 */
export function hasBoundVariableAt(node: SceneNode, field: string, index?: number): boolean {
  const bound = (node as { boundVariables?: Record<string, unknown> }).boundVariables;
  const entry = bound?.[field];
  if (entry !== undefined && entry !== null) {
    if (typeof index === "number" && Array.isArray(entry)) {
      if (entry[index] !== undefined && entry[index] !== null) return true;
    } else {
      return true;
    }
  }
  if (typeof index === "number" && (field === "fills" || field === "strokes" || field === "effects")) {
    const list = (node as unknown as Record<string, unknown>)[field];
    if (Array.isArray(list) && paintHasVariable(list[index])) return true;
  }
  return false;
}

/** Whether a shared style (fill/stroke/effect) is applied to the node, which counts as tokenized. */
export function hasStyleApplied(node: SceneNode, field: "fills" | "strokes" | "effects"): boolean {
  const key = field === "fills" ? "fillStyleId" : field === "strokes" ? "strokeStyleId" : "effectStyleId";
  const id = (node as unknown as Record<string, unknown>)[key];
  // figma.mixed (a symbol) means some segments are styled — treat as styled rather than guess.
  return typeof id === "symbol" || (typeof id === "string" && id !== "");
}

export function getSolidFills(node: SceneNode): Paint[] {
  if (!("fills" in node)) return [];
  const fills = (node as MinimalFillsMixin).fills;
  if (fills === figma.mixed || !Array.isArray(fills)) return [];
  return fills.filter((p): p is Paint => (p as Paint).type === "SOLID" && (p as Paint).visible !== false);
}

export function hasVisibleFill(node: SceneNode): boolean {
  return getSolidFills(node).length > 0;
}

export function nodeHasAnyText(node: SceneNode): boolean {
  if (node.type === "TEXT") return true;
  if ("children" in node) {
    return (node as ChildrenMixin).children.some((c) => nodeHasAnyText(c as SceneNode));
  }
  return false;
}

export function isInteractiveKind(kind: string | undefined): boolean {
  return !!kind && ["button", "input", "checkbox", "radio", "switch", "select", "link", "menu-item", "tab"].includes(kind);
}

export function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
