import type { ComponentDoc, VariableToken } from '@shared/types';

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
