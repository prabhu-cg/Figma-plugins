import React, { useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { ChangeListItem } from "@ui/components/ChangeListItem";
import { ChangeDetail } from "@ui/components/ChangeDetail";
import { SearchIcon, TrackIcon } from "@ui/components/Icons";
import type { ChangeCategory } from "@shared/types/change";

type EntityFilter = "all" | "components" | "tokens";
type BreakingFilter = "all" | "breaking";

export function ChangesPage() {
  const { project } = useProjectState();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ChangeCategory | "all">("all");
  const [entityType, setEntityType] = useState<EntityFilter>("all");
  const [breaking, setBreaking] = useState<BreakingFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const changeSet = useMemo(() => {
    if (!project?.currentBaselineId) return undefined;
    const sets = project.changeSets.filter((cs) => cs.baselineId === project.currentBaselineId);
    if (sets.length === 0) return undefined;
    return sets.reduce((latest, cs) => (cs.createdAt > latest.createdAt ? cs : latest));
  }, [project]);

  const filtered = useMemo(() => {
    if (!changeSet) return [];
    const q = search.trim().toLowerCase();
    return changeSet.changes.filter((c) => {
      if (category !== "all" && c.category !== category) return false;
      if (entityType === "components" && c.entityType !== "component") return false;
      if (entityType === "tokens" && c.entityType !== "token") return false;
      if (breaking === "breaking" && !c.breaking && !c.potentialBreaking) return false;
      if (q && !`${c.entityName} ${c.summary}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [changeSet, search, category, entityType, breaking]);

  if (!project) return null;

  if (!changeSet || changeSet.changes.length === 0) {
    return (
      <div className="state-screen">
        <div className="state-icon">
          <TrackIcon style={{ width: 24, height: 24 }} />
        </div>
        <div className="state-title">No changes detected</div>
        <div className="state-body">
          Run a scan from the Overview tab after editing components or tokens to see what changed.
        </div>
      </div>
    );
  }

  const componentCount = changeSet.changes.filter((c) => c.entityType === "component").length;
  const tokenCount = changeSet.changes.filter((c) => c.entityType === "token").length;
  const selected = filtered.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="view" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ flexShrink: 0, paddingBottom: 12, marginBottom: 4, borderBottom: "1px solid var(--color-border)" }}>
        <div className="view-header" style={{ marginBottom: 16 }}>
          <div>
            <div className="view-title">Changes</div>
            <div className="view-subtitle">
              {changeSet.changes.length} changes detected · {componentCount} components · {tokenCount} tokens
            </div>
          </div>
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
            <select className="select" value={entityType} onChange={(e) => setEntityType(e.target.value as EntityFilter)}>
              <option value="all">All entities</option>
              <option value="components">Components</option>
              <option value="tokens">Tokens</option>
            </select>
          </div>
          <div className="select-wrapper">
            <select className="select" value={breaking} onChange={(e) => setBreaking(e.target.value as BreakingFilter)}>
              <option value="all">All changes</option>
              <option value="breaking">Breaking only</option>
            </select>
          </div>
        </div>

        {changeSet.scanSummary.skippedItems.length > 0 && (
          <details style={{ marginTop: 12, fontSize: 11.5 }} className="text-secondary">
            <summary>
              {changeSet.scanSummary.componentsScanned + changeSet.scanSummary.tokensScanned} scanned,{" "}
              {changeSet.scanSummary.skippedItems.length} skipped
            </summary>
            <ul style={{ marginTop: 6, paddingLeft: 16 }}>
              {changeSet.scanSummary.skippedItems.map((item) => (
                <li key={item.id}>
                  {item.name}: {item.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingTop: 12 }}>
        {filtered.length === 0 ? (
          <div className="card state-card">
            <div className="text-secondary">No changes match these filters.</div>
          </div>
        ) : (
          <div className="grid" style={{ gridTemplateColumns: "1fr 360px", alignItems: "start" }}>
            <div className="flex flex-col gap-2" style={{ paddingRight: 4 }}>
              {filtered.map((change) => (
                <ChangeListItem
                  key={change.id}
                  change={change}
                  selected={selectedId === change.id}
                  onSelect={() => setSelectedId(change.id)}
                />
              ))}
            </div>
            <ChangeDetail change={selected} changeSetId={changeSet.id} />
          </div>
        )}
      </div>
    </div>
  );
}
