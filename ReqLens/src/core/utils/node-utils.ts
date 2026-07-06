import type { AnalyzableNode } from '@core/types/figma-node.types';

/** Lowercased, whitespace-collapsed name for fuzzy matching against layer names. */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** True if the node's own name matches any of the given substrings or regexes. */
export function nameMatches(node: AnalyzableNode, patterns: ReadonlyArray<string | RegExp>): boolean {
  const normalized = normalizeName(node.name);
  return patterns.some((pattern) =>
    typeof pattern === 'string' ? normalized.includes(pattern) : pattern.test(normalized),
  );
}

/** Depth-first pre-order walk, calling `visit` for every node in the subtree (including the root). */
export function walk(node: AnalyzableNode, visit: (node: AnalyzableNode) => void): void {
  visit(node);
  for (const child of node.children ?? []) walk(child, visit);
}

/** Collects all nodes in the subtree matching a predicate. */
export function findAll(node: AnalyzableNode, predicate: (node: AnalyzableNode) => boolean): AnalyzableNode[] {
  const matches: AnalyzableNode[] = [];
  walk(node, (n) => {
    if (predicate(n)) matches.push(n);
  });
  return matches;
}

/** True if any descendant (including the node itself) matches the predicate. */
export function hasDescendant(node: AnalyzableNode, predicate: (node: AnalyzableNode) => boolean): boolean {
  if (predicate(node)) return true;
  return (node.children ?? []).some((child) => hasDescendant(child, predicate));
}

/** Total node count in the subtree, including the root. */
export function countNodes(node: AnalyzableNode): number {
  let count = 1;
  for (const child of node.children ?? []) count += countNodes(child);
  return count;
}

/**
 * Best-effort visible label for a node: its own text content if it's a TEXT
 * node, otherwise the first non-empty TEXT descendant, truncated for display.
 */
export function extractLabel(node: AnalyzableNode, maxLength = 60): string | undefined {
  const textNode = findAll(node, (n) => n.type === 'TEXT' && !!n.characters?.trim()).at(0);
  const text = node.type === 'TEXT' ? node.characters : textNode?.characters;
  if (!text) return undefined;
  const trimmed = text.trim().replace(/\s+/g, ' ');
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

/** Concatenation of all TEXT descendant contents, useful for keyword scanning across a component. */
export function collectAllText(node: AnalyzableNode): string {
  return findAll(node, (n) => n.type === 'TEXT' && !!n.characters)
    .map((n) => n.characters ?? '')
    .join(' ')
    .toLowerCase();
}

export function directChildren(node: AnalyzableNode): readonly AnalyzableNode[] {
  return node.children ?? [];
}
