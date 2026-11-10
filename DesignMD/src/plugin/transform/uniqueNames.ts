import type { StyleToken, VariableToken } from '@shared/types';

/**
 * CSS names are made by dropping every character that is not a letter or digit, so different names
 * can collapse into one: "divider ↓", "divider ↑" and "divider →" all become --border-divider-divider.
 * In tokens.css the later declaration would silently overwrite the earlier one, and a token reference
 * by cssName would be ambiguous. Later tokens get a numeric suffix (-2, -3, ...); the first keeps its
 * name. Order is variables, then text, color, effect and grid styles, each in the order given
 * (library styles come last), so the result is stable.
 */
export function makeCssNamesUnique(
  variables: VariableToken[],
  styles: { text: StyleToken[]; color: StyleToken[]; effect: StyleToken[]; grid: StyleToken[] },
): { renamed: number } {
  const taken = new Set<string>();
  let renamed = 0;
  const claim = (token: { cssName: string }) => {
    if (!taken.has(token.cssName)) {
      taken.add(token.cssName);
      return;
    }
    const base = token.cssName;
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    token.cssName = `${base}-${n}`;
    taken.add(token.cssName);
    renamed++;
  };
  variables.forEach(claim);
  [...styles.text, ...styles.color, ...styles.effect, ...styles.grid].forEach(claim);
  return { renamed };
}
