import React, { useEffect, useMemo, useState } from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { Banner, OptionCard } from "@ui/components/Shared";
import type { ComponentScanScope } from "@shared/types/scan";
import type { PageId } from "@ui/App";
import {
  CheckCircleIcon,
  DocumentStackIcon,
  PageGlyphIcon,
  SelectionIcon,
  TokenGlyphIcon,
} from "@ui/components/Icons";

const SCOPE_OPTIONS: Array<{ id: ComponentScanScope; label: string; description: string; icon: React.ReactNode }> = [
  {
    id: "selection",
    label: "Selection",
    description: "Only currently selected components / component sets",
    icon: <SelectionIcon />,
  },
  {
    id: "current-page",
    label: "Current page",
    description: "Every component on the active page",
    icon: <PageGlyphIcon />,
  },
  {
    id: "document",
    label: "Entire document",
    description: "Every component in the file (may be slow on huge files)",
    icon: <DocumentStackIcon />,
  },
];

export function TrackPage({ onNavigate }: { onNavigate: (page: PageId) => void }) {
  const { discovered, send, lastBaseline, clearLastBaseline, scanning } = useProjectState();
  const [scope, setScope] = useState<ComponentScanScope | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tokensEnabled, setTokensEnabled] = useState(false);
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
    if (!scope) return;
    send({ type: "discover-components", scope, pageIds: [] });
    setHasDiscovered(true);
  };

  const canCreateBaseline = !!scope && selectedIds.size > 0 && name.trim().length > 0 && version.trim().length > 0;

  const createBaseline = () => {
    if (!scope) return;
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
    <div className="view" style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div style={{ flex: "1 1 auto" }}>
        <div className="view-header">
          <div>
            <div className="view-title">Track</div>
            <div className="view-subtitle">Choose what DSLog tracks, then create a baseline</div>
          </div>
        </div>

        <Banner kind="info" style={{ marginBottom: "var(--space-3)" }}>
          A baseline is a snapshot of your components and tokens right now. Once it exists, DSLog compares
          future scans against it to tell you what changed — so create one whenever you want a new starting
          point to track from.
        </Banner>

        <div className="grid" style={{ gridTemplateColumns: "1fr 360px" }}>
          <div className="card-title">Components</div>
          <div className="card-title">Create baseline</div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              {SCOPE_OPTIONS.map((opt) => (
                <OptionCard
                  key={opt.id}
                  icon={opt.icon}
                  title={opt.label}
                  description={opt.description}
                  selected={scope === opt.id}
                  onSelect={() => setScope(opt.id)}
                  variant="radio"
                />
              ))}
            </div>

            <div>
              <div className="card-title" style={{ marginBottom: 8 }}>
                Tokens
              </div>
              <OptionCard
                icon={<TokenGlyphIcon />}
                title="Track variables (design tokens)"
                description="All local variable collections in this file will be tracked — color, number, string, and boolean variables across every mode."
                selected={tokensEnabled}
                onSelect={() => setTokensEnabled((v) => !v)}
              />
            </div>

            <div>
              <button className="btn btn-secondary btn-sm" onClick={discover} disabled={scanning || !scope}>
                Find components
              </button>
            </div>
          </div>

          <div className="card">
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
            </div>

            {hasDiscovered && (
              <div style={{ marginTop: "var(--space-3)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: "var(--space-2)" }}>
                  <span className="card-title">{discovered.length} found</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setSelectedIds(allSelected ? new Set() : new Set(discovered.map((c) => c.id)))}
                  >
                    {allSelected ? "Clear all" : "Select all"}
                  </button>
                </div>

                <div style={{ maxHeight: 280, overflowY: "auto" }}>
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
        </div>
      </div>

      <div className="card" style={{ marginTop: "var(--space-3)" }}>
        <div className="flex items-center justify-between">
          <span className="text-secondary" style={{ fontSize: 12.5 }}>
            {selectedIds.size} component{selectedIds.size === 1 ? "" : "s"} selected
          </span>
          <button className="btn btn-primary" disabled={!canCreateBaseline || scanning} onClick={createBaseline}>
            {scanning ? "Scanning…" : "Create baseline"}
          </button>
        </div>
      </div>
    </div>
  );
}
