import type { ComponentsFileV1, Layer, TokenRef } from './componentsSchema';

/** A reference that points at an id or property key that does not exist in the file. */
export interface BrokenRef {
  /** Where the reference was found, for example "Button > tree > Label". */
  at: string;
  /** What kind of reference it is. */
  kind: 'variableId' | 'styleId' | 'componentId' | 'propertyKey' | 'defaultVariantId';
  /** The id or key that was not found. */
  target: string;
}

/**
 * Rule 6 of the spec: every referenced id must exist in the file. Returns the broken references;
 * an empty array means the file is consistent. Component ids may also point at components that
 * are not in this file (instances of external libraries), so `instanceOf.componentId` is only
 * checked against the file when `checkInstances` is set.
 */
export function findBrokenRefs(
  file: ComponentsFileV1,
  options: { checkInstances?: boolean } = {},
): BrokenRef[] {
  const broken: BrokenRef[] = [];
  const componentIds = new Set(file.components.map((c) => c.id));

  const checkToken = (ref: TokenRef | undefined, at: string) => {
    if (!ref) return;
    if (ref.variableId && !(ref.variableId in file.tokens))
      broken.push({ at, kind: 'variableId', target: ref.variableId });
    if (ref.styleId && !(ref.styleId in file.tokens))
      broken.push({ at, kind: 'styleId', target: ref.styleId });
  };

  for (const component of file.components) {
    const base = component.name;
    const propertyKeys = new Set(component.properties.map((p) => p.key));
    for (const id of component.boundVariableIds)
      if (!(id in file.tokens)) broken.push({ at: base, kind: 'variableId', target: id });
    for (const id of component.styleIds)
      if (!(id in file.tokens)) broken.push({ at: base, kind: 'styleId', target: id });
    if (!component.variants.some((v) => v.id === component.defaultVariantId))
      broken.push({ at: base, kind: 'defaultVariantId', target: component.defaultVariantId });

    const walk = (layer: Layer, at: string) => {
      layer.fills?.forEach((p) => checkToken(p.token, at));
      layer.strokes?.paints.forEach((p) => checkToken(p.token, at));
      layer.effects?.forEach((e) => checkToken(e.token, at));
      checkToken(layer.text?.token, at);
      layer.text?.runs?.forEach((r) => checkToken(r.token, at));
      if (layer.text?.styleId && !(layer.text.styleId in file.tokens))
        broken.push({ at, kind: 'styleId', target: layer.text.styleId });
      if (
        options.checkInstances &&
        layer.instanceOf &&
        !componentIds.has(layer.instanceOf.componentId)
      )
        broken.push({ at, kind: 'componentId', target: layer.instanceOf.componentId });
      for (const key of Object.values(layer.propertyRefs ?? {}))
        if (key && !propertyKeys.has(key)) broken.push({ at, kind: 'propertyKey', target: key });
      layer.children.forEach((c) => walk(c, `${at} > ${c.name}`));
    };
    walk(component.tree, `${base} > ${component.tree.name}`);
  }
  return broken;
}
