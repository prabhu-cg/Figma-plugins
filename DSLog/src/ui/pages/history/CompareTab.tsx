import { useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import { formatValue } from "@ui/components/ChangeDetail";
import { StatCard, CategoryBadge, BreakingBadge } from "@ui/components/Shared";
import { SearchIcon } from "@ui/components/Icons";
import { summarizeChanges } from "@shared/utils/changeSetStats";
import { getEffectiveClassification } from "@shared/utils/classification";
import type { Change, ChangeCategory } from "@shared/types/change";

type CompareEntityFilter = "all" | "components" | "tokens";
type CompareBreakingFilter = "all" | "breaking";

export function CompareTab() {
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
                    onSelect={setSelectedChangeId}
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
