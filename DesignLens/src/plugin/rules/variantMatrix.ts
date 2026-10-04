export const MAX_COMBINATION_SPACE = 200;

export function cartesianProduct(valuesByProp: [string, string[]][]): Record<string, string>[] {
  return valuesByProp.reduce<Record<string, string>[]>(
    (acc, [prop, values]) => acc.flatMap((combo) => values.map((value) => ({ ...combo, [prop]: value }))),
    [{}]
  );
}

export function comboKey(combo: Record<string, string>): string {
  return JSON.stringify(Object.entries(combo).sort());
}

