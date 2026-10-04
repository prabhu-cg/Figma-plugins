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

/** Tokens bound by more components than this (and >25% of all components) don't signal relatedness. */
const MIN_COMMON_TOKEN_USERS = 20;
const COMMON_TOKEN_FRACTION = 0.25;
const MAX_RELATED = 10;

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
      layout: c.layout,
      styleIds: c.styleIds ?? [],
    };
  });

  // Two components are "related" if they draw from the same tokens — a deterministic proxy for
  // "these probably belong to the same design system family". Tokens bound by most components
  // (e.g. color/white) say nothing about family, so they're ignored once the system is big enough,
  // and the rest are weighted by rarity (1 / number of components binding them). Built via an
  // inverted index rather than an O(n^2) comparison so this stays fast with 5,000+ components.
  const docsByVariableId = new Map<string, number[]>();
  docs.forEach((doc, index) => {
    for (const variableId of doc.boundVariableIds) {
      const list = docsByVariableId.get(variableId);
      if (list) list.push(index);
      else docsByVariableId.set(variableId, [index]);
    }
  });
  const commonThreshold = Math.max(MIN_COMMON_TOKEN_USERS, docs.length * COMMON_TOKEN_FRACTION);

  docs.forEach((doc, index) => {
    const scores = new Map<number, number>();
    for (const variableId of doc.boundVariableIds) {
      const sharers = docsByVariableId.get(variableId) ?? [];
      if (sharers.length > commonThreshold) continue;
      const weight = 1 / sharers.length;
      for (const otherIndex of sharers) {
        if (otherIndex !== index) scores.set(otherIndex, (scores.get(otherIndex) ?? 0) + weight);
      }
    }
    doc.relatedComponentNames = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1] || docs[a[0]].name.localeCompare(docs[b[0]].name))
      .slice(0, MAX_RELATED)
      .map(([i]) => docs[i].name);
  });

  return docs;
}
