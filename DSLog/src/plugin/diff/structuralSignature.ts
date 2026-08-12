import type { ComponentSnapshot, NodeStructureSnapshot } from "@shared/types/component";
import type { TokenSnapshot } from "@shared/types/token";
import { hashObject } from "@shared/utils/hash";

/**
 * Content signature for a component that deliberately excludes
 * identity.name/id/componentSetName and metadata — everything a rename
 * changes — so an added+removed pair with a matching signature is a strong
 * rename candidate (spec §13). Used only as a heuristic input to
 * `detectPossibleRenames`; it never merges entities on its own.
 */
export function componentStructuralSignature(component: ComponentSnapshot): string {
  return hashObject({
    properties: [...component.properties]
      .map((p) => ({ name: p.name, type: p.type }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    variants: [...component.variants]
      .map((v) => v.properties)
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    structureShape: structureShape(component.structure),
    dimensions: component.dimensions,
    layout: component.layout,
  });
}

function structureShape(node: NodeStructureSnapshot): unknown {
  return { type: node.type, children: node.children.map(structureShape) };
}

/**
 * Content signature for a token, excluding name/id/collection — a rename
 * can also move a variable between collections. Deliberately weaker than
 * the component signature (type + scopes + per-mode value shape only);
 * `key` equality is the primary rename signal for tokens, this is the
 * fallback (spec §13's "normalized structural signature").
 */
export function tokenStructuralSignature(token: TokenSnapshot): string {
  return hashObject({
    type: token.type,
    scopes: [...token.scopes].sort(),
    modeCount: token.valuesByMode.length,
    modeValueKinds: token.valuesByMode.map((m) => (m.aliasTo ? "alias" : typeof m.value)).sort(),
  });
}
