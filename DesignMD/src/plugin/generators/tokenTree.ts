/**
 * Builds nested JSON objects from dotted/sliced token paths, e.g. entries
 * with path ["primary","500"] and ["primary","600"] become
 * { primary: { "500": <leaf>, "600": <leaf> } }. Shared by tokens.json and
 * css-tokens.json so both preserve the same variable/style hierarchy.
 */
export interface TokenTreeEntry<TLeaf> {
  path: string[];
  leaf: TLeaf;
}

export type TokenTreeNode<TLeaf> = TLeaf | { [key: string]: TokenTreeNode<TLeaf> };

function isLeaf<TLeaf>(
  node: TokenTreeNode<TLeaf>,
  leafTag: (v: unknown) => boolean,
): node is TLeaf {
  return leafTag(node);
}

export function buildTokenTree<TLeaf>(
  entries: TokenTreeEntry<TLeaf>[],
  leafTag: (v: unknown) => boolean = (v) =>
    typeof v === 'object' && v !== null && ('$value' in (v as object) || '$type' in (v as object)),
): Record<string, TokenTreeNode<TLeaf>> {
  const root: Record<string, TokenTreeNode<TLeaf>> = {};

  for (const { path, leaf } of entries) {
    if (path.length === 0) continue;
    let cursor: Record<string, TokenTreeNode<TLeaf>> = root;

    for (let i = 0; i < path.length - 1; i++) {
      const segment = path[i];
      const existing = cursor[segment];
      if (existing === undefined) {
        const next: Record<string, TokenTreeNode<TLeaf>> = {};
        cursor[segment] = next;
        cursor = next;
      } else if (isLeaf(existing, leafTag)) {
        // Name collision between a leaf and a namespace (e.g. "spacing" used
        // both as a token and a group) — keep the leaf, nest the rest under "_".
        const next = (cursor[`${segment}_`] ??= {} as Record<string, TokenTreeNode<TLeaf>>);
        cursor = next as Record<string, TokenTreeNode<TLeaf>>;
      } else {
        cursor = existing as Record<string, TokenTreeNode<TLeaf>>;
      }
    }

    const lastSegment = path[path.length - 1];
    if (cursor[lastSegment] !== undefined && !isLeaf(cursor[lastSegment], leafTag)) {
      cursor[`${lastSegment}_`] = leaf as TokenTreeNode<TLeaf>;
    } else {
      cursor[lastSegment] = leaf as TokenTreeNode<TLeaf>;
    }
  }

  return root;
}

/** Drops a leading path segment if it case-insensitively matches `category` (avoids color.color.primary.500). */
export function stripRedundantCategoryPrefix(path: string[], category: string): string[] {
  if (path.length > 1 && path[0].toLowerCase() === category.toLowerCase()) {
    return path.slice(1);
  }
  return path;
}
