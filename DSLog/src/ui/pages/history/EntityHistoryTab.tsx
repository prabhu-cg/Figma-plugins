import { useEffect, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { DeprecationControl } from "@ui/components/DeprecationControl";
import { ImpactIndexControl } from "@ui/components/ImpactIndexControl";
import { SearchIcon } from "@ui/components/Icons";
import { getEntityHistory } from "@shared/utils/entityHistory";
import type { EntityKind } from "@shared/types/entity";
import { formatDate } from "./formatDate";
import { ComponentImpactSection, TokenDependencyChain, TokenImpactSection } from "./EntityImpact";

export function EntityHistoryTab({
  kind,
  focusEntityId,
  onFocusConsumed,
}: {
  kind: Extract<EntityKind, "component" | "token">;
  focusEntityId?: string;
  onFocusConsumed?: () => void;
}) {
  const { project } = useProjectState();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusEntityId) return;
    setSearch("");
    setSelectedId(focusEntityId);
    onFocusConsumed?.();
  }, [focusEntityId]);

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
