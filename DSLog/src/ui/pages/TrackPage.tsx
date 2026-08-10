import React, { useEffect, useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Tabs } from "@ui/components/Tabs";
import type { ComponentScanScope } from "@shared/types/scan";
import type { PageId } from "@ui/App";
import { CheckCircleIcon } from "@ui/components/Icons";

type Tab = "components" | "tokens";

const SCOPE_OPTIONS: Array<{ id: ComponentScanScope; label: string; description: string }> = [
  { id: "selection", label: "Selection", description: "Only currently selected components / component sets" },
  { id: "current-page", label: "Current page", description: "Every component on the active page" },
  { id: "document", label: "Entire document", description: "Every component in the file (may be slow on huge files)" },
];

export function TrackPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { discovered, send, lastBaseline, clearLastBaseline, scanning } = useProjectState();
  const [tab, setTab] = useState<Tab>("components");
  const [scope, setScope] = useState<ComponentScanScope>("current-page");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tokensEnabled, setTokensEnabled] = useState(true);
  const [name, setName] = useState("Initial Design System");
  const [version, setVersion] = useState("1.0.0");
  const [description, setDescription] = useState("Initial tracked version");
  const [hasDiscovered, setHasDiscovered] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set(discovered.map((c) => c.id)));
  }, [discovered]);

  const allSelected = discovered.length > 0 && selectedIds.size === discovered.length;

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const discover = () => {
    send({ type: "discover-components", scope, pageIds: [] });
    setHasDiscovered(true);
  };

  const canCreateBaseline = selectedIds.size > 0 && name.trim().length > 0 && version.trim().length > 0;

  const createBaseline = () => {
    send({
      type: "create-baseline",
      name: name.trim(),
      version: version.trim(),
      description: description.trim() || undefined,
      tracking: {
        components: { scope, includedIds: Array.from(selectedIds), pageIds: [] },
        tokens: { enabled: tokensEnabled, includedCollectionIds: [] },
      },
    });
  };

  const grouped = useMemo(() => {
    const byPage = new Map<string, typeof discovered>();
    for (const c of discovered) {
      const list = byPage.get(c.pageName) ?? [];
      list.push(c);
      byPage.set(c.pageName, list);
    }
    return byPage;
  }, [discovered]);

  if (lastBaseline) {
    return (
      <div className="view">
        <div className="state-screen" style={{ height: "auto", paddingTop: "var(--space-6)" }}>
          <div className="state-icon" style={{ background: "var(--color-success-soft)", color: "var(--color-success)" }}>
            <CheckCircleIcon style={{ width: 24, height: 24 }} />
          </div>
          <div className="state-title">Baseline created</div>
          <div className="grid grid-cols-2" style={{ width: 320 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-value">{lastBaseline.snapshot.components.length}</div>
              <div className="stat-label">Components</div>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <div className="stat-value">{lastBaseline.snapshot.tokens.length}</div>
              <div className="stat-label">Tokens</div>
            </div>
          </div>
          <div className="text-secondary">Version {lastBaseline.version}</div>
          <button
            className="btn btn-primary"
            onClick={() => {
              clearLastBaseline();
              onNavigate("overview");
            }}
          >
            View baseline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Track</div>
          <div className="view-subtitle">Choose what DSLog tracks, then create a baseline</div>
        </div>
      </div>

      <Tabs
        tabs={[
          { id: "components", label: "Components" },
          { id: "tokens", label: "Tokens" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "components" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3">
            {SCOPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setScope(opt.id)}
                className="card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  border: `1px solid ${scope === opt.id ? "var(--color-primary)" : "var(--color-border)"}`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{opt.label}</span>
                  {scope === opt.id && <span className="badge badge-success">Selected</span>}
                </div>
                <div className="text-secondary" style={{ fontSize: 12, marginTop: 6 }}>
                  {opt.description}
                </div>
              </button>
            ))}
          </div>

          <div>
            <button className="btn btn-primary btn-sm" onClick={discover} disabled={scanning}>
              Find components
            </button>
          </div>

          {hasDiscovered && (
            <div className="card">
              <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
                <span className="card-title">{discovered.length} components found</span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setSelectedIds(allSelected ? new Set() : new Set(discovered.map((c) => c.id)))}
                >
                  {allSelected ? "Clear all" : "Select all"}
                </button>
              </div>

              <div style={{ maxHeight: 260, overflowY: "auto" }}>
                {Array.from(grouped.entries()).map(([pageName, items]) => (
                  <div key={pageName}>
                    <div className="text-tertiary" style={{ fontSize: 10, textTransform: "uppercase", marginTop: 10, marginBottom: 2 }}>
                      {pageName}
                    </div>
                    {items.map((item) => (
                      <label key={item.id} className="checkbox-row">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} />
                        <span style={{ fontSize: 12.5 }}>{item.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "tokens" && (
        <div className="card">
          <label className="checkbox-row">
            <input type="checkbox" checked={tokensEnabled} onChange={(e) => setTokensEnabled(e.target.checked)} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>Track variables (design tokens)</span>
          </label>
          <p className="text-secondary" style={{ fontSize: 12.5, marginTop: 8 }}>
            All local variable collections in this file will be tracked — color, number, string, and boolean
            variables across every mode.
          </p>
        </div>
      )}

      <div className="card" style={{ marginTop: "var(--space-3)" }}>
        <div className="card-title" style={{ marginBottom: 12 }}>
          Create baseline
        </div>
        <div className="flex flex-col gap-3">
          <label className="field">
            <span className="field-label">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Version</span>
            <input className="input" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Description</span>
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </label>
          <div>
            <button className="btn btn-primary" disabled={!canCreateBaseline || scanning} onClick={createBaseline}>
              {scanning ? "Scanning…" : "Create baseline"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
