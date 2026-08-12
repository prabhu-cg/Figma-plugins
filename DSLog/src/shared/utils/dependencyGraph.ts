import type { DesignSystemSnapshot } from "@shared/types/project";
import type { InstanceIndex } from "@shared/types/instance";
import { buildTokenAliasGraph } from "./tokenGraph";

export type DependencyEntityType = "component" | "componentSet" | "instance" | "token" | "variableCollection" | "style";
export type DependencyRelation = "usesToken" | "contains" | "instanceOf" | "belongsTo" | "aliases";

export interface DependencyEdge {
  from: string;
  fromType: DependencyEntityType;
  to: string;
  toType: DependencyEntityType;
  relation: DependencyRelation;
}

/**
 * Internal dependency graph (spec §8), expressed as a flat edge list (a
 * list view, per the spec's own "acceptable initially" — no graph
 * visualization). Built entirely from data already captured by a normal
 * scan plus the optional document-wide InstanceIndex; never a new Figma
 * call itself.
 */
export function buildDependencyGraph(snapshot: DesignSystemSnapshot, instanceIndex?: InstanceIndex): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  for (const component of snapshot.components) {
    for (const binding of component.tokens) {
      edges.push({
        from: component.identity.id,
        fromType: "component",
        to: binding.variableId,
        toType: "token",
        relation: "usesToken",
      });
    }
    if (component.identity.componentSetId) {
      edges.push({
        from: component.identity.id,
        fromType: "component",
        to: component.identity.componentSetId,
        toType: "componentSet",
        relation: "belongsTo",
      });
    }
  }

  const aliasGraph = buildTokenAliasGraph(snapshot.tokens);
  for (const [tokenId, targets] of aliasGraph) {
    for (const targetId of targets) {
      edges.push({ from: tokenId, fromType: "token", to: targetId, toType: "token", relation: "aliases" });
    }
  }

  if (instanceIndex) {
    for (const entry of Object.values(instanceIndex.byComponentId)) {
      for (const instanceId of entry.sampleInstanceIds) {
        edges.push({
          from: instanceId,
          fromType: "instance",
          to: entry.componentId,
          toType: "component",
          relation: "instanceOf",
        });
      }
      for (const containingComponentId of entry.containingComponentIds) {
        edges.push({
          from: containingComponentId,
          fromType: "component",
          to: entry.componentId,
          toType: "component",
          relation: "contains",
        });
      }
    }
  }

  return edges;
}

/** Other components whose own structure contains an instance of this one. */
export function getDependentComponentIds(edges: DependencyEdge[], componentId: string): string[] {
  return edges.filter((e) => e.relation === "contains" && e.to === componentId).map((e) => e.from);
}

/** Tokens a component binds directly. */
export function getComponentTokenIds(edges: DependencyEdge[], componentId: string): string[] {
  return edges.filter((e) => e.relation === "usesToken" && e.from === componentId).map((e) => e.to);
}
