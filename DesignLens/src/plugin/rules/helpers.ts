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

export function hasBoundVariableAt(node: SceneNode, field: string, index?: number): boolean {
  const bound = (node as { boundVariables?: Record<string, unknown> }).boundVariables;
  if (!bound) return false;
  const entry = bound[field];
  if (entry === undefined || entry === null) return false;
  if (typeof index === "number" && Array.isArray(entry)) {
    return entry[index] !== undefined && entry[index] !== null;
  }
  return true;
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
