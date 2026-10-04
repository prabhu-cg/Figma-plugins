import type { ComponentDoc, VariableToken } from '@shared/types';
import type { RawComponent } from '../extraction/rawTypes';

/**
 * Reverse index of transformComponents' variableId -> component lookup: for each
 * variable, which components (by name) bind it. Lets outputs flag unused tokens
 * and show "used by" without every generator re-deriving the inverted index.
 */
export function computeVariableUsage(
  variables: VariableToken[],
  components: ComponentDoc[],
): VariableToken[] {
  const namesByVariableId = new Map<string, Set<string>>();
  for (const component of components) {
    for (const variableId of component.boundVariableIds) {
      const names = namesByVariableId.get(variableId);
      if (names) names.add(component.name);
      else namesByVariableId.set(variableId, new Set([component.name]));
    }
  }

  return variables.map((variable) => ({
    ...variable,
    usedByComponents: Array.from(namesByVariableId.get(variable.id) ?? []).sort((a, b) =>
      a.localeCompare(b),
    ),
  }));
}

/**
 * Adds the variables bound inside each style a component applies, so tokens used only
 * through a text/color/effect style still count as used by that component.
 */
export function mergeStyleBoundVariables(
  components: RawComponent[],
  styles: Array<{ id: string; boundVariableIds: string[] }>,
): RawComponent[] {
  const variableIdsByStyleId = new Map(
    styles.filter((s) => s.boundVariableIds.length > 0).map((s) => [s.id, s.boundVariableIds]),
  );
  if (variableIdsByStyleId.size === 0) return components;

  return components.map((component) => {
    const extra = (component.styleIds ?? []).flatMap((id) => variableIdsByStyleId.get(id) ?? []);
    if (extra.length === 0) return component;
    return {
      ...component,
      boundVariableIds: Array.from(new Set([...component.boundVariableIds, ...extra])),
    };
  });
}
