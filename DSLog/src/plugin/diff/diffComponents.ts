import type { ComponentSnapshot } from "@shared/types/component";
import type { RawChange } from "./rawChange";
import { valuesEqual } from "./rawChange";
import { diffStructure } from "./diffStructure";

function byId(components: ComponentSnapshot[]): Map<string, ComponentSnapshot> {
  return new Map(components.map((c) => [c.identity.id, c]));
}

function diffProperties(before: ComponentSnapshot, after: ComponentSnapshot): RawChange[] {
  const changes: RawChange[] = [];
  const beforeByName = new Map(before.properties.map((p) => [p.name, p]));
  const afterByName = new Map(after.properties.map((p) => [p.name, p]));
  const id = after.identity.id;
  const name = after.identity.name;

  for (const [propName, prop] of afterByName) {
    if (!beforeByName.has(propName)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "property-added",
        field: propName,
        after: prop,
      });
    }
  }
  for (const [propName, prop] of beforeByName) {
    if (!afterByName.has(propName)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "property-removed",
        field: propName,
        before: prop,
      });
    }
  }
  for (const [propName, beforeProp] of beforeByName) {
    const afterProp = afterByName.get(propName);
    if (!afterProp) continue;
    if (beforeProp.type !== afterProp.type) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "property-type-changed",
        field: propName,
        before: beforeProp,
        after: afterProp,
      });
    } else if (!valuesEqual(beforeProp, afterProp)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "property-changed",
        field: propName,
        before: beforeProp,
        after: afterProp,
      });
    }
  }
  return changes;
}

function diffVariants(before: ComponentSnapshot, after: ComponentSnapshot): RawChange[] {
  const changes: RawChange[] = [];
  const beforeByName = new Map(before.variants.map((v) => [v.name, v]));
  const afterByName = new Map(after.variants.map((v) => [v.name, v]));
  const id = after.identity.id;
  const name = after.identity.name;

  for (const [variantName, variant] of afterByName) {
    if (!beforeByName.has(variantName)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "variant-added",
        field: variantName,
        after: variant,
      });
    }
  }
  for (const [variantName, variant] of beforeByName) {
    if (!afterByName.has(variantName)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: name,
        changeType: "variant-removed",
        field: variantName,
        before: variant,
      });
    }
  }
  return changes;
}

export function diffComponents(baseline: ComponentSnapshot[], current: ComponentSnapshot[]): RawChange[] {
  const changes: RawChange[] = [];
  const baselineMap = byId(baseline);
  const currentMap = byId(current);

  for (const [id, component] of currentMap) {
    if (!baselineMap.has(id)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: component.identity.name,
        changeType: "component-added",
        after: { name: component.identity.name, componentSetName: component.identity.componentSetName },
      });
    }
  }

  for (const [id, component] of baselineMap) {
    if (!currentMap.has(id)) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: component.identity.name,
        changeType: "component-removed",
        before: { name: component.identity.name, componentSetName: component.identity.componentSetName },
      });
    }
  }

  for (const [id, before] of baselineMap) {
    const after = currentMap.get(id);
    if (!after) continue;
    if (before.hash === after.hash) continue;

    if (before.identity.name !== after.identity.name) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: after.identity.name,
        changeType: "component-renamed",
        before: before.identity.name,
        after: after.identity.name,
      });
    }
    if (before.metadata.description !== after.metadata.description) {
      changes.push({
        entityType: "component",
        entityId: id,
        entityName: after.identity.name,
        changeType: "component-description-changed",
        before: before.metadata.description,
        after: after.metadata.description,
      });
    }

    changes.push(...diffProperties(before, after));
    changes.push(...diffVariants(before, after));
    changes.push(...diffStructure(id, after.identity.name, before.structure, after.structure));
  }

  return changes;
}
