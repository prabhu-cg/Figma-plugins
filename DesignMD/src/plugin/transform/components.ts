import type { ComponentDoc, ComponentProperty, ComponentVariant } from '@shared/types';
import type { RawComponent } from '../extraction/rawTypes';

function collectVariantPropertyValues(
  variants: ComponentVariant[],
  propertyNamePattern: RegExp,
): string[] {
  const values = new Set<string>();
  for (const variant of variants) {
    for (const [propName, propValue] of Object.entries(variant.variantProperties)) {
      if (propertyNamePattern.test(propName)) values.add(propValue);
    }
  }
  return Array.from(values);
}

const STATE_PATTERN = /state/i;
const SIZE_PATTERN = /size/i;

export function transformComponents(raw: RawComponent[]): ComponentDoc[] {
  const docs: ComponentDoc[] = raw.map((c) => {
    const variants: ComponentVariant[] = c.variants.map((v) => ({
      id: v.id,
      name: v.name,
      variantProperties: v.variantProperties,
      description: v.description,
    }));

    const properties: ComponentProperty[] = c.properties.map((p) => ({
      name: p.name,
      type: p.type as ComponentProperty['type'],
      defaultValue: p.defaultValue,
      variantOptions: p.variantOptions,
    }));

    return {
      id: c.id,
      key: c.key,
      name: c.name,
      description: c.description,
      isComponentSet: c.isComponentSet,
      variants,
      properties,
      states: collectVariantPropertyValues(variants, STATE_PATTERN),
      sizes: collectVariantPropertyValues(variants, SIZE_PATTERN),
      boundVariableIds: c.boundVariableIds,
      relatedComponentNames: [],
      pageName: c.pageName,
    };
  });

  // Two components are "related" if they share at least one bound variable
  // (i.e. they draw from the same tokens) — a deterministic proxy for
  // "these probably belong to the same design system family". Built via an
  // inverted index (variableId -> component indices) rather than an O(n^2)
  // comparison so this stays fast for design systems with 5,000+ components.
  const docsByVariableId = new Map<string, number[]>();
  docs.forEach((doc, index) => {
    for (const variableId of doc.boundVariableIds) {
      const list = docsByVariableId.get(variableId);
      if (list) list.push(index);
      else docsByVariableId.set(variableId, [index]);
    }
  });

  docs.forEach((doc, index) => {
    if (doc.boundVariableIds.length === 0) return;
    const relatedIndices = new Set<number>();
    for (const variableId of doc.boundVariableIds) {
      for (const otherIndex of docsByVariableId.get(variableId) ?? []) {
        if (otherIndex !== index) relatedIndices.add(otherIndex);
        if (relatedIndices.size >= 10) break;
      }
      if (relatedIndices.size >= 10) break;
    }
    doc.relatedComponentNames = Array.from(relatedIndices)
      .slice(0, 10)
      .map((i) => docs[i].name);
  });

  return docs;
}
