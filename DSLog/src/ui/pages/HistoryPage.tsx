import { useEffect, useState } from "react";
import { Tabs } from "@ui/components/Tabs";
import { ReleasesTab } from "./history/ReleasesTab";
import { EntityHistoryTab } from "./history/EntityHistoryTab";
import { DeprecationsTab } from "./history/DeprecationsTab";
import { CompareTab } from "./history/CompareTab";

export type HistoryTab = "releases" | "components" | "tokens" | "deprecations" | "compare";

export function HistoryPage({
  focusTab,
  focusEntityId,
  onFocusConsumed,
}: {
  focusTab?: HistoryTab;
  focusEntityId?: string;
  onFocusConsumed?: () => void;
} = {}) {
  const [tab, setTab] = useState<HistoryTab>(focusTab ?? "releases");

  useEffect(() => {
    if (focusTab) setTab(focusTab);
  }, [focusTab]);

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
        {tab === "releases" && (
          <ReleasesTab
            focusReleaseId={tab === focusTab ? focusEntityId : undefined}
            onFocusConsumed={onFocusConsumed}
          />
        )}
        {tab === "components" && (
          <EntityHistoryTab
            kind="component"
            focusEntityId={tab === focusTab ? focusEntityId : undefined}
            onFocusConsumed={onFocusConsumed}
          />
        )}
        {tab === "tokens" && (
          <EntityHistoryTab
            kind="token"
            focusEntityId={tab === focusTab ? focusEntityId : undefined}
            onFocusConsumed={onFocusConsumed}
          />
        )}
        {tab === "deprecations" && <DeprecationsTab />}
        {tab === "compare" && <CompareTab />}
      </div>
    </div>
  );
}
