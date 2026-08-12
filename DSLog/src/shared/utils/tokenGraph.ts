import type { ComponentSnapshot } from "@shared/types/component";
import type { TokenSnapshot } from "@shared/types/token";

/**
 * Forward alias graph: tokenId -> the set of token ids it aliases to
 * (unioned across all modes — a token can point at different targets per
 * mode). Built entirely from data already captured by a normal token scan;
 * no new Figma calls needed (spec §9).
 */
export function buildTokenAliasGraph(tokens: TokenSnapshot[]): Map<string, Set<string>> {
  const graph = new Map<string, Set<string>>();
  for (const token of tokens) {
    const targets = new Set<string>();
    for (const mode of token.valuesByMode) {
      if (mode.aliasTo) targets.add(mode.aliasTo.variableId);
    }
    graph.set(token.id, targets);
  }
  return graph;
}

/** Reverse of buildTokenAliasGraph: tokenId -> the set of tokens that alias to it. */
export function buildReverseTokenAliasGraph(tokens: TokenSnapshot[]): Map<string, Set<string>> {
  const forward = buildTokenAliasGraph(tokens);
  const reverse = new Map<string, Set<string>>();
  for (const [tokenId, targets] of forward) {
    for (const target of targets) {
      const set = reverse.get(target) ?? new Set<string>();
      set.add(tokenId);
      reverse.set(target, set);
    }
  }
  return reverse;
}

/** Components that bind this exact token id directly (from ComponentSnapshot.tokens). */
export function directTokenUsers(components: ComponentSnapshot[], tokenId: string): ComponentSnapshot[] {
  return components.filter((c) => c.tokens.some((binding) => binding.variableId === tokenId));
}

export interface TokenImpact {
  /** Every token that transitively aliases to this one (directly or through a chain). */
  aliasingTokenIds: string[];
  /** Components bound directly to this token. */
  directComponentIds: string[];
  /** Components bound to a token that (directly or transitively) aliases to this one. */
  indirectComponentIds: string[];
}

/**
 * "If this token changes, what's affected?" (spec §7's token impact
 * mockup — "Direct bindings" / "Indirect component dependencies"). Walks
 * the reverse alias graph transitively; entirely derived from already-
 * scanned data.
 */
export function getTokenImpact(tokens: TokenSnapshot[], components: ComponentSnapshot[], tokenId: string): TokenImpact {
  const reverse = buildReverseTokenAliasGraph(tokens);

  const aliasing = new Set<string>();
  const queue = [tokenId];
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const dependent of reverse.get(current) ?? []) {
      if (!aliasing.has(dependent)) {
        aliasing.add(dependent);
        queue.push(dependent);
      }
    }
  }

  const directComponentIds = new Set(directTokenUsers(components, tokenId).map((c) => c.identity.id));
  const indirectComponentIds = new Set<string>();
  for (const aliasingTokenId of aliasing) {
    for (const c of directTokenUsers(components, aliasingTokenId)) {
      if (!directComponentIds.has(c.identity.id)) indirectComponentIds.add(c.identity.id);
    }
  }

  return {
    aliasingTokenIds: Array.from(aliasing),
    directComponentIds: Array.from(directComponentIds),
    indirectComponentIds: Array.from(indirectComponentIds),
  };
}

export interface TokenChainNode {
  tokenId: string;
  tokenName: string;
  directComponentNames: string[];
  children: TokenChainNode[];
}

/**
 * Downstream dependency chain from a token through every token that aliases
 * to it, down to the components that consume each leaf (spec §9's
 * `color.text.primary -> color.content.default -> Button -> 47 instances`
 * mockup — instance counts are Phase 2, component names ship now). Cycle-
 * guarded since alias chains are user-editable Figma data, not guaranteed
 * acyclic.
 */
export function buildTokenDependencyChain(
  tokens: TokenSnapshot[],
  components: ComponentSnapshot[],
  tokenId: string,
): TokenChainNode | undefined {
  const reverse = buildReverseTokenAliasGraph(tokens);
  const tokensById = new Map(tokens.map((t) => [t.id, t]));

  function build(id: string, seen: Set<string>): TokenChainNode | undefined {
    const token = tokensById.get(id);
    if (!token || seen.has(id)) return undefined;
    const nextSeen = new Set(seen).add(id);
    const childIds = Array.from(reverse.get(id) ?? []);
    return {
      tokenId: id,
      tokenName: token.name,
      directComponentNames: directTokenUsers(components, id).map((c) => c.identity.name),
      children: childIds
        .map((childId) => build(childId, nextSeen))
        .filter((n): n is TokenChainNode => Boolean(n)),
    };
  }

  return build(tokenId, new Set());
}
