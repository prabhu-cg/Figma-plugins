import React, { useEffect, useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Button } from "@ui/components/Button";
import type { ComponentScanScope } from "@shared/types/scan";
import type { PageId } from "@ui/App";

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
      <div className="dslog-page">
        <div className="dslog-card dslog-card--success">
          <h3>Baseline created</h3>
          <div className="dslog-stat-row">
            <div>
              <div className="dslog-stat-num">{lastBaseline.snapshot.components.length}</div>
              <div className="dslog-stat-name">Components</div>
            </div>
            <div>
              <div className="dslog-stat-num">{lastBaseline.snapshot.tokens.length}</div>
              <div className="dslog-stat-name">Tokens</div>
            </div>
          </div>
          <div className="dslog-label">Version {lastBaseline.version}</div>
          <Button
            variant="primary"
            onClick={() => {
              clearLastBaseline();
              onNavigate("overview");
            }}
          >
            View baseline
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="dslog-page">
      <div className="dslog-tabs">
        <button className={`dslog-tab ${tab === "components" ? "is-active" : ""}`} onClick={() => setTab("components")}>
          Components
        </button>
        <button className={`dslog-tab ${tab === "tokens" ? "is-active" : ""}`} onClick={() => setTab("tokens")}>
          Tokens
        </button>
      </div>

      {tab === "components" && (
        <div className="dslog-section">
          <div className="dslog-label">Scope</div>
          <div className="dslog-radio-group">
            {SCOPE_OPTIONS.map((opt) => (
              <label key={opt.id} className="dslog-radio">
                <input
                  type="radio"
                  name="scope"
                  checked={scope === opt.id}
                  onChange={() => setScope(opt.id)}
                />
                <div>
                  <div className="dslog-radio__label">{opt.label}</div>
                  <div className="dslog-radio__desc">{opt.description}</div>
                </div>
              </label>
            ))}
          </div>

          <Button onClick={discover} disabled={scanning}>
            Find components
          </Button>

          {hasDiscovered && (
            <>
              <div className="dslog-row-between">
                <span className="dslog-label">{discovered.length} components found</span>
                <div>
                  <button
                    className="dslog-link"
                    onClick={() => setSelectedIds(allSelected ? new Set() : new Set(discovered.map((c) => c.id)))}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>
              </div>

              <div className="dslog-checklist">
                {Array.from(grouped.entries()).map(([pageName, items]) => (
                  <div key={pageName}>
                    <div className="dslog-checklist__group">{pageName}</div>
                    {items.map((item) => (
                      <label key={item.id} className="dslog-checkbox">
                        <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggle(item.id)} />
                        <span>{item.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "tokens" && (
        <div className="dslog-section">
          <label className="dslog-checkbox">
            <input type="checkbox" checked={tokensEnabled} onChange={(e) => setTokensEnabled(e.target.checked)} />
            <span>Track variables (design tokens)</span>
          </label>
          <p className="dslog-hint">
            All local variable collections in this file will be tracked — color, number, string, and boolean
            variables across every mode.
          </p>
        </div>
      )}

      <div className="dslog-section dslog-section--form">
        <div className="dslog-label">Create baseline</div>
        <label className="dslog-field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="dslog-field">
          <span>Version</span>
          <input value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label className="dslog-field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </label>
        <Button variant="primary" disabled={!canCreateBaseline || scanning} onClick={createBaseline}>
          {scanning ? "Scanning…" : "Create baseline"}
        </Button>
      </div>
    </div>
  );
}
