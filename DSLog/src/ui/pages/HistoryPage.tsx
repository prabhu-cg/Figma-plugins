import React, { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Tabs } from "@ui/components/Tabs";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import { ChangeDetail, formatValue } from "@ui/components/ChangeDetail";
import { DeprecationControl } from "@ui/components/DeprecationControl";
import { ImpactIndexControl } from "@ui/components/ImpactIndexControl";
import { StatCard, CategoryBadge, BreakingBadge } from "@ui/components/Shared";
import { SearchIcon } from "@ui/components/Icons";
import { getEntityHistory } from "@shared/utils/entityHistory";
import { summarizeChanges } from "@shared/utils/changeSetStats";
import { getEffectiveClassification } from "@shared/utils/classification";
import { buildTokenDependencyChain, getTokenImpact, type TokenChainNode } from "@shared/utils/tokenGraph";
import { buildDependencyGraph, getDependentComponentIds } from "@shared/utils/dependencyGraph";
import type { EntityKind, TrackedEntity } from "@shared/types/entity";
import type { Change, ChangeCategory } from "@shared/types/change";
import type { TokenSnapshot } from "@shared/types/token";
import type { ComponentSnapshot } from "@shared/types/component";
import type { DesignSystemSnapshot, Project } from "@shared/types/project";
import type { InstanceIndex } from "@shared/types/instance";

type HistoryTab = "releases" | "components" | "tokens" | "deprecations" | "compare";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

export function HistoryPage() {
  const [tab, setTab] = useState<HistoryTab>("releases");

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, marginBottom: 16 }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">History</div>
            <div className="view-subtitle">Browse changes across releases, components, and tokens</div>
          </div>
        </div>
        <Tabs
          tabs={[
            { id: "releases", label: "Releases" },
            { id: "components", label: "Components" },
            { id: "tokens", label: "Tokens" },
            { id: "deprecations", label: "Deprecations" },
            { id: "compare", label: "Compare" },
          ]}
          active={tab}
          onChange={(id) => setTab(id as HistoryTab)}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {tab === "releases" && <ReleasesTab />}
        {tab === "components" && <EntityHistoryTab kind="component" />}
        {tab === "tokens" && <EntityHistoryTab kind="token" />}
        {tab === "deprecations" && <DeprecationsTab />}
        {tab === "compare" && <CompareTab />}
      </div>
    </div>
  );
}

function ReleasesTab() {
  const { project } = useProjectState();
  const [selectedReleaseId, setSelectedReleaseId] = useState<string | null>(null);
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  if (!project) return null;
  const releases = [...project.releases].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  if (releases.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-title">No releases yet</div>
        <div className="state-body">Create a release from the Releases tab to start building release history.</div>
      </div>
    );
  }

  const selectedRelease = releases.find((r) => r.id === selectedReleaseId) ?? releases[0];
  const changeSet = project.changeSets.find((cs) => cs.id === selectedRelease?.changeSetId);
  const selectedChange = changeSet?.changes.find((c) => c.id === selectedChangeId) ?? null;

  return (
    <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start", gap: "var(--space-3)" }}>
      <div className="flex flex-col gap-2">
        {releases.map((release) => {
          const cs = project.changeSets.find((c) => c.id === release.changeSetId);
          const stats = summarizeChanges(cs?.changes ?? []);
          const active = selectedRelease?.id === release.id;
          return (
            <button
              key={release.id}
              className="card"
              style={{ textAlign: "left", border: `1px solid ${active ? "var(--color-primary)" : "var(--color-border)"}` }}
              onClick={() => {
                setSelectedReleaseId(release.id);
                setSelectedChangeId(null);
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 13.5 }}>v{release.version}</div>
              <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
                {formatDate(release.createdAt)}
              </div>
              <div className="text-secondary" style={{ fontSize: 12, marginTop: 8 }}>
                {stats.total} change{stats.total === 1 ? "" : "s"}
                {stats.breaking > 0 && <> · {stats.breaking} breaking</>}
                {stats.deprecated > 0 && <> · {stats.deprecated} deprecated</>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
        <div className="flex flex-col gap-2">
          {(changeSet?.changes.length ?? 0) === 0 ? (
            <div className="card state-card">
              <div className="text-secondary">No changes in this release.</div>
            </div>
          ) : (
            changeSet?.changes.map((change) => (
              <ChangeListItem
                key={change.id}
                change={change}
                selected={selectedChangeId === change.id}
                onSelect={() => setSelectedChangeId(change.id)}
              />
            ))
          )}
        </div>
        <ChangeDetail change={selectedChange} changeSetId={changeSet?.id ?? ""} />
      </div>
    </div>
  );
}

function EntityHistoryTab({ kind }: { kind: Extract<EntityKind, "component" | "token"> }) {
  const { project } = useProjectState();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!project) return null;

  const baseline = project.baselines.find((b) => b.id === project.currentBaselineId);
  const liveEntities =
    kind === "component"
      ? (baseline?.snapshot.components ?? []).map((c) => ({ id: c.identity.id, name: c.identity.name }))
      : (baseline?.snapshot.tokens ?? []).map((t) => ({ id: t.id, name: t.name }));
  const trackedOnly = project.trackedEntities
    .filter((e) => e.kind === kind && !liveEntities.some((live) => live.id === e.id))
    .map((e) => ({ id: e.id, name: e.displayName }));
  const allEntities = [...liveEntities, ...trackedOnly].sort((a, b) => a.name.localeCompare(b.name));

  if (allEntities.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-title">Nothing tracked yet</div>
        <div className="state-body">
          Create a baseline to start tracking {kind === "component" ? "components" : "tokens"}.
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filteredEntities = q ? allEntities.filter((e) => e.name.toLowerCase().includes(q)) : allEntities;
  const selected = allEntities.find((e) => e.id === selectedId) ?? filteredEntities[0];
  const history = selected ? getEntityHistory(project, selected.id) : [];
  const latestReleaseGroup = history.find((g) => g.release);
  const trackedEntity = selected ? project.trackedEntities.find((e) => e.id === selected.id) : undefined;

  return (
    <div className="flex flex-col gap-3">
      <ImpactIndexControl />
      <div className="grid" style={{ gridTemplateColumns: "260px 1fr", alignItems: "start", gap: "var(--space-3)" }}>
      <div className="flex flex-col gap-2">
        <div style={{ position: "relative" }}>
          <SearchIcon
            style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
          />
          <input
            className="input"
            style={{ paddingLeft: 30, width: "100%" }}
            placeholder={`Search ${kind}s…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1" style={{ maxHeight: "calc(100vh - 260px)", overflowY: "auto" }}>
          {filteredEntities.map((e) => (
            <button
              key={e.id}
              className="card"
              style={{
                textAlign: "left",
                padding: "8px 10px",
                border: `1px solid ${selected?.id === e.id ? "var(--color-primary)" : "var(--color-border)"}`,
              }}
              onClick={() => setSelectedId(e.id)}
            >
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{e.name}</div>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <div className="flex flex-col gap-3">
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 15 }}>{selected.name}</div>
            <div className="text-secondary" style={{ fontSize: 12, marginTop: 2 }}>
              Current version:{" "}
              {latestReleaseGroup?.release
                ? `v${latestReleaseGroup.release.version}`
                : baseline
                  ? `v${baseline.version} (unreleased)`
                  : "—"}
            </div>
          </div>

          <DeprecationControl entityId={selected.id} kind={kind} displayName={selected.name} trackedEntity={trackedEntity} />

          {baseline &&
            (kind === "component" ? (
              <ComponentImpactSection
                snapshot={baseline.snapshot}
                instanceIndex={project.instanceIndex}
                componentId={selected.id}
              />
            ) : (
              <TokenImpactSection
                tokens={baseline.snapshot.tokens}
                components={baseline.snapshot.components}
                instanceIndex={project.instanceIndex}
                tokenId={selected.id}
              />
            ))}

          {kind === "token" && baseline && (
            <TokenDependencyChain
              tokens={baseline.snapshot.tokens}
              components={baseline.snapshot.components}
              tokenId={selected.id}
              instanceIndex={project.instanceIndex}
            />
          )}

          {history.length === 0 ? (
            <div className="card state-card">
              <div className="text-secondary">No recorded history for this {kind} yet.</div>
            </div>
          ) : (
            history.map((group, i) => (
              <div key={group.release?.id ?? `unreleased-${i}`} className="card">
                <div className="card-title" style={{ marginBottom: 8 }}>
                  {group.release ? `v${group.release.version} · ${formatDate(group.release.createdAt)}` : "Unreleased"}
                </div>
                <ul style={{ display: "flex", flexDirection: "column", gap: 6, paddingLeft: 16, margin: 0 }}>
                  {group.changes.map((change) => (
                    <li key={change.id} style={{ fontSize: 12.5 }}>
                      {change.summary}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="card state-card">
          <div className="text-secondary">Select a {kind} to see its history.</div>
        </div>
      )}
      </div>
    </div>
  );
}

function ComponentImpactSection({
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

function TokenImpactSection({
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

function TokenDependencyChain({
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

/** Earliest release published on/after the deprecation, or "Unreleased" if none exists yet. */
function findDeprecatedInVersion(project: Project, deprecatedAt: string | undefined): string {
  if (!deprecatedAt) return "Unreleased";
  const candidates = project.releases
    .filter((r) => r.createdAt >= deprecatedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return candidates[0] ? `v${candidates[0].version}` : "Unreleased";
}

function DeprecationsTab() {
  const { project } = useProjectState();
  if (!project) return null;

  const deprecated = project.trackedEntities.filter((e) => e.deprecated);
  const needsMigration = deprecated.filter((e) => !e.replacement?.trim());
  const replacementAvailable = deprecated.filter((e) => e.replacement?.trim());

  if (deprecated.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-title">Nothing deprecated</div>
        <div className="state-body">
          Mark a component, variant, property, or token deprecated from its History entry to see it here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3">
        <StatCard label="Deprecated" value={deprecated.length} />
        <StatCard label="Needs migration" value={needsMigration.length} />
        <StatCard label="Replacement available" value={replacementAvailable.length} />
      </div>
      <div className="flex flex-col gap-2">
        {deprecated.map((entity) => (
          <DeprecatedItemCard key={entity.id} entity={entity} project={project} />
        ))}
      </div>
    </div>
  );
}

function DeprecatedItemCard({ entity, project }: { entity: TrackedEntity; project: Project }) {
  const deprecatedInVersion = findDeprecatedInVersion(project, entity.deprecatedAt);
  const instanceCount = entity.kind === "component" ? project.instanceIndex?.byComponentId[entity.id]?.count : undefined;

  return (
    <div className="card">
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{entity.displayName}</div>
        <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 2 }}>
          Deprecated in {deprecatedInVersion}
          {instanceCount !== undefined && (
            <>
              {" "}
              · {instanceCount} instance{instanceCount === 1 ? "" : "s"} affected
            </>
          )}
        </div>
      </div>
      <DeprecationControl entityId={entity.id} kind={entity.kind} displayName={entity.displayName} trackedEntity={entity} />
    </div>
  );
}

type CompareEntityFilter = "all" | "components" | "tokens";
type CompareBreakingFilter = "all" | "breaking";

function CompareTab() {
  const { project, send, comparing, comparisonResult, clearComparisonResult } = useProjectState();
  const [releaseIdA, setReleaseIdA] = useState("");
  const [releaseIdB, setReleaseIdB] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ChangeCategory | "all">("all");
  const [entityType, setEntityType] = useState<CompareEntityFilter>("all");
  const [breaking, setBreaking] = useState<CompareBreakingFilter>("all");
  const [selectedChangeId, setSelectedChangeId] = useState<string | null>(null);

  if (!project) return null;
  const releases = [...project.releases].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  if (releases.length < 2) {
    return (
      <div className="state-screen">
        <div className="state-title">Need at least two releases</div>
        <div className="state-body">Create a second release to compare against a previous one.</div>
      </div>
    );
  }

  const canCompare = Boolean(releaseIdA) && Boolean(releaseIdB) && releaseIdA !== releaseIdB;
  const showingResult =
    comparisonResult && comparisonResult.releaseIdA === releaseIdA && comparisonResult.releaseIdB === releaseIdB;
  const changes = showingResult ? comparisonResult.changeSet.changes : [];
  const stats = summarizeChanges(changes);

  const q = search.trim().toLowerCase();
  const filtered = changes.filter((c) => {
    const effective = getEffectiveClassification(c);
    if (category !== "all" && effective.category !== category) return false;
    if (entityType === "components" && c.entityType !== "component") return false;
    if (entityType === "tokens" && c.entityType !== "token") return false;
    if (breaking === "breaking" && !effective.breaking && !effective.potentialBreaking) return false;
    if (q && !`${c.entityName} ${c.summary}`.toLowerCase().includes(q)) return false;
    return true;
  });
  const selectedChange = filtered.find((c) => c.id === selectedChangeId) ?? null;

  function onSelectRelease(which: "a" | "b", id: string) {
    if (which === "a") setReleaseIdA(id);
    else setReleaseIdB(id);
    setSelectedChangeId(null);
    clearComparisonResult();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="card">
        <div className="flex items-center gap-2 wrap">
          <div className="select-wrapper" style={{ flex: "1 1 160px" }}>
            <select className="select" value={releaseIdA} onChange={(e) => onSelectRelease("a", e.target.value)}>
              <option value="">Select a release…</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version}
                </option>
              ))}
            </select>
          </div>
          <span className="text-tertiary" style={{ fontSize: 12 }}>
            vs
          </span>
          <div className="select-wrapper" style={{ flex: "1 1 160px" }}>
            <select className="select" value={releaseIdB} onChange={(e) => onSelectRelease("b", e.target.value)}>
              <option value="">Select a release…</option>
              {releases.map((r) => (
                <option key={r.id} value={r.id}>
                  v{r.version}
                </option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-primary btn-sm"
            disabled={!canCompare || comparing}
            onClick={() => send({ type: "compare-releases", releaseIdA, releaseIdB })}
          >
            {comparing ? "Comparing…" : "Compare"}
          </button>
        </div>
      </div>

      {showingResult && (
        <>
          <div className="grid grid-cols-4">
            <StatCard label="Added" value={stats.added} />
            <StatCard label="Changed" value={stats.modified} />
            <StatCard label="Removed" value={stats.removed} />
            <StatCard label="Breaking" value={stats.breaking} />
          </div>

          <div className="flex items-center gap-2 wrap">
            <div style={{ position: "relative", flex: "1 1 200px" }}>
              <SearchIcon
                style={{ position: "absolute", left: 10, top: 9, width: 14, height: 14, color: "var(--color-text-tertiary)" }}
              />
              <input
                className="input"
                style={{ paddingLeft: 30, width: "100%" }}
                placeholder="Search changes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="select-wrapper">
              <select className="select" value={category} onChange={(e) => setCategory(e.target.value as ChangeCategory | "all")}>
                <option value="all">All categories</option>
                <option value="added">Added</option>
                <option value="modified">Changed</option>
                <option value="removed">Removed</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </div>
            <div className="select-wrapper">
              <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value as CompareEntityFilter)}>
                <option value="all">All entities</option>
                <option value="components">Components</option>
                <option value="tokens">Tokens</option>
              </select>
            </div>
            <div className="select-wrapper">
              <select className="select" value={breaking} onChange={(e) => setBreaking(e.target.value as CompareBreakingFilter)}>
                <option value="all">All changes</option>
                <option value="breaking">Breaking only</option>
              </select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="card state-card">
              <div className="text-secondary">No changes match these filters.</div>
            </div>
          ) : (
            <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
              <div className="flex flex-col gap-2">
                {filtered.map((change) => (
                  <ChangeListItem
                    key={change.id}
                    change={change}
                    selected={selectedChangeId === change.id}
                    onSelect={() => setSelectedChangeId(change.id)}
                  />
                ))}
              </div>
              <CompareChangeDetail change={selectedChange} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Read-only counterpart to ChangeDetail for release comparisons — the
 * underlying changeSet is ephemeral (never persisted, see main.ts's
 * "compare-releases" handler), so editing review state/notes here would
 * silently fail against a changeSet id that doesn't exist in storage.
 */
function CompareChangeDetail({ change }: { change: Change | null }) {
  if (!change) {
    return (
      <div className="card state-card" style={{ position: "sticky", top: 0 }}>
        <div className="text-secondary">Select a change to see the full detail.</div>
      </div>
    );
  }
  const effective = getEffectiveClassification(change);

  return (
    <div className="card" style={{ position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="flex items-center gap-2 wrap">
        <CategoryBadge category={effective.category} />
        <BreakingBadge breaking={effective.breaking} potential={effective.potentialBreaking} />
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{change.entityName}</div>
        <div className="text-secondary" style={{ marginTop: 4, fontSize: 12.5 }}>
          {change.summary}
        </div>
      </div>
      {change.modeDetails && change.modeDetails.length > 0 ? (
        <div className="flex flex-col">
          {change.modeDetails.map((mode) => (
            <div key={mode.modeName} className="mode-row">
              <span style={{ fontWeight: 700 }}>{mode.modeName}</span>
              {mode.changed ? (
                <span className="mode-row-diff">
                  <span>{formatValue(mode.before)}</span>
                  <span aria-hidden>→</span>
                  <span>{formatValue(mode.after)}</span>
                </span>
              ) : (
                <span className="text-tertiary">No change</span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-3">
          <div style={{ flex: 1 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              Before
            </div>
            <div className="code-block">{formatValue(change.before)}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>
              After
            </div>
            <div className="code-block">{formatValue(change.after)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
