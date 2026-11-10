/**
 * Role inference for components.json layers. A pure function of the layer tree.
 *
 * Priority, highest first (the result says which rule decided it in `roleSource`):
 *   1. property: a component property drives the layer (TEXT -> label/text, INSTANCE_SWAP -> icon/slot)
 *   2. type:     the node type or paint (image fill -> image, line or thin shape -> divider, small vector -> icon)
 *   3. name:     a layer-name heuristic. Lowest confidence.
 *   4. none:     role is "unknown"
 * Text and container layers that no rule above matched still get "text" / "container" from their type.
 * The root of the tree is always "root". Roles are hints, never facts.
 */
import type { Layer, LayerRole, RoleSource } from '@shared/componentsSchema';

export interface RoleResult {
  role: LayerRole;
  roleSource: RoleSource;
}

const ICON_MAX_SIZE = 64;
const LABEL_MAX_CHARS = 40;
const VECTOR_TYPES = new Set(['VECTOR', 'BOOLEAN_OPERATION', 'STAR', 'POLYGON', 'ELLIPSE']);
const CONTAINER_TYPES = new Set([
  'FRAME',
  'GROUP',
  'COMPONENT',
  'COMPONENT_SET',
  'INSTANCE',
  'SECTION',
]);

/** Name rules in priority order. Matched on whole words, so "Iconography" is not an icon. */
const NAME_RULES: Array<[LayerRole, RegExp]> = [
  ['heading', /\b(heading|headline|title|h[1-6])\b/i],
  ['button', /\b(button|btn|cta)\b/i],
  ['link', /\b(link|anchor)\b/i],
  ['input', /\b(input|field|textfield|textarea)\b/i],
  ['divider', /\b(divider|separator|hr|rule)\b/i],
  ['icon', /\b(icon|glyph|chevron|caret|arrow)\b/i],
  ['image', /\b(image|img|photo|picture|avatar|thumbnail|illustration)\b/i],
  ['slot', /\b(slot|placeholder)\b/i],
  ['label', /\b(label|caption)\b/i],
];

const words = (name: string) => name.replace(/[_\-/.]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');

function isSmall(layer: Layer): boolean {
  return (
    layer.size !== undefined &&
    layer.size.width <= ICON_MAX_SIZE &&
    layer.size.height <= ICON_MAX_SIZE
  );
}

function fromProperty(layer: Layer): RoleResult | undefined {
  const refs = layer.propertyRefs;
  if (refs?.characters) {
    const chars = layer.text?.characters;
    const short = chars === undefined || (chars.length <= LABEL_MAX_CHARS && !chars.includes('\n'));
    return { role: short ? 'label' : 'text', roleSource: 'property' };
  }
  if (refs?.mainComponent) {
    return { role: isSmall(layer) ? 'icon' : 'slot', roleSource: 'property' };
  }
  return undefined;
}

function fromType(layer: Layer): RoleResult | undefined {
  if (layer.fills?.some((p) => p.visible && p.type === 'IMAGE')) {
    return { role: 'image', roleSource: 'type' };
  }
  if (layer.type === 'LINE') return { role: 'divider', roleSource: 'type' };
  if (
    layer.type === 'RECTANGLE' &&
    layer.children.length === 0 &&
    layer.size !== undefined &&
    Math.min(layer.size.width, layer.size.height) <= 2 &&
    Math.max(layer.size.width, layer.size.height) > 8
  ) {
    return { role: 'divider', roleSource: 'type' };
  }
  if (VECTOR_TYPES.has(layer.type) && isSmall(layer)) return { role: 'icon', roleSource: 'type' };
  return undefined;
}

function fromName(layer: Layer): RoleResult | undefined {
  const name = words(layer.name);
  for (const [role, pattern] of NAME_RULES) {
    if (pattern.test(name)) return { role, roleSource: 'name' };
  }
  return undefined;
}

/** The role of one layer. `isRoot` marks the top of a component's tree. */
export function inferRole(layer: Layer, isRoot = false): RoleResult {
  if (isRoot) return { role: 'root', roleSource: 'type' };
  const found = fromProperty(layer) ?? fromType(layer) ?? fromName(layer);
  if (found) return found;
  if (layer.type === 'TEXT') return { role: 'text', roleSource: 'type' };
  if (CONTAINER_TYPES.has(layer.type) && layer.children.length > 0) {
    return { role: 'container', roleSource: 'type' };
  }
  return { role: 'unknown', roleSource: 'none' };
}

/** Returns a copy of the tree with `role` and `roleSource` set on every layer. */
export function assignRoles(layer: Layer, isRoot = true): Layer {
  const { role, roleSource } = inferRole(layer, isRoot);
  return {
    ...layer,
    role,
    roleSource,
    children: layer.children.map((child) => assignRoles(child, false)),
  };
}
