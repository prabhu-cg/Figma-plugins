import { StatCard } from "@ui/components/Shared";
import { buildTokenDependencyChain, getTokenImpact, type TokenChainNode } from "@shared/utils/tokenGraph";
import { buildDependencyGraph, getDependentComponentIds } from "@shared/utils/dependencyGraph";
import type { TokenSnapshot } from "@shared/types/token";
import type { ComponentSnapshot } from "@shared/types/component";
import type { DesignSystemSnapshot } from "@shared/types/project";
import type { InstanceIndex } from "@shared/types/instance";

export function ComponentImpactSection({
  snapshot,
  instanceIndex,
  componentId,
}: {
  snapshot: DesignSystemSnapshot;
  instanceIndex: InstanceIndex | undefined;
  componentId: string;
}) {
  const edges = buildDependencyGraph(snapshot, instanceIndex);
  const entry = instanceIndex?.byComponentId[componentId];
  const dependentComponentIds = getDependentComponentIds(edges, componentId);

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Impact
      </div>
      {!instanceIndex ? (
        <div className="text-secondary" style={{ fontSize: 12 }}>
          Build the impact index above to see instances found and potentially affected screens.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2" style={{ marginBottom: 12 }}>
            <StatCard label="Instances found" value={entry?.count ?? 0} />
            <StatCard label="Dependent components" value={dependentComponentIds.length} />
          </div>
          {entry && entry.containerNames.length > 0 && (
            <div>
              <div className="text-secondary" style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 4 }}>
                Potentially affected
              </div>
              <div className="text-secondary" style={{ fontSize: 12.5 }}>
                {entry.containerNames.join(", ")}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function TokenImpactSection({
  tokens,
  components,
  instanceIndex,
  tokenId,
}: {
  tokens: TokenSnapshot[];
  components: ComponentSnapshot[];
  instanceIndex: InstanceIndex | undefined;
  tokenId: string;
}) {
  const impact = getTokenImpact(tokens, components, tokenId, instanceIndex);
  const usedByComponents = impact.directComponentIds.length + impact.indirectComponentIds.length;

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Impact
      </div>
      <div className="grid grid-cols-2">
        <StatCard
          label="Used by"
          value={`${usedByComponents} component${usedByComponents === 1 ? "" : "s"}`}
          sub={impact.totalInstanceCount !== undefined ? `${impact.totalInstanceCount} instances` : "Build impact index for instance counts"}
        />
        <StatCard label="Direct bindings" value={impact.directComponentIds.length} />
      </div>
      {impact.indirectComponentIds.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <StatCard label="Indirect component dependencies" value={impact.indirectComponentIds.length} />
        </div>
      )}
    </div>
  );
}

export function TokenDependencyChain({
  tokens,
  components,
  tokenId,
  instanceIndex,
}: {
  tokens: TokenSnapshot[];
  components: ComponentSnapshot[];
  tokenId: string;
  instanceIndex: InstanceIndex | undefined;
}) {
  const chain = buildTokenDependencyChain(tokens, components, tokenId, instanceIndex);
  if (!chain || (chain.children.length === 0 && chain.directComponentNames.length === 0)) return null;

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 8 }}>
        Dependency chain
      </div>
      <TokenChainNodeView node={chain} depth={0} />
    </div>
  );
}

function TokenChainNodeView({ node, depth }: { node: TokenChainNode; depth: number }) {
  return (
    <div style={{ paddingLeft: depth * 16, fontSize: 12.5 }}>
      <div className="flex items-center gap-2" style={{ padding: "4px 0" }}>
        {depth > 0 && (
          <span aria-hidden className="text-tertiary">
            ↓
          </span>
        )}
        <span style={{ fontWeight: depth === 0 ? 700 : 500 }}>{node.tokenName}</span>
      </div>
      {node.directComponentNames.map((name) => (
        <div key={name} className="text-secondary" style={{ paddingLeft: 16 + depth * 16, padding: "2px 0" }}>
          ↓ {name}
        </div>
      ))}
      {node.directComponentNames.length > 0 && node.totalInstanceCount !== undefined && (
        <div className="text-tertiary" style={{ paddingLeft: 32 + depth * 16, padding: "2px 0" }}>
          ↓ {node.totalInstanceCount} instance{node.totalInstanceCount === 1 ? "" : "s"}
        </div>
      )}
      {node.children.map((child) => (
        <TokenChainNodeView key={child.tokenId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
