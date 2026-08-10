import React from "react";
import type { Change } from "@shared/types/change";
import { CategoryBadge, BreakingBadge } from "./Shared";

export function ChangeListItem({
  change,
  selected,
  onSelect,
}: {
  change: Change;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="card"
      style={{
        textAlign: "left",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        width: "100%",
        opacity: change.reviewed ? 0.6 : 1,
        border: `1px solid ${selected ? "var(--color-primary)" : "var(--color-border)"}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CategoryBadge category={change.category} />
          <BreakingBadge breaking={change.breaking} potential={change.potentialBreaking} />
        </div>
        {change.reviewed && <span className="badge badge-neutral">Reviewed</span>}
      </div>
      <div style={{ fontWeight: 700, fontSize: 12.5 }}>{change.entityName}</div>
      <div className="text-secondary" style={{ fontSize: 12 }}>
        {change.summary}
      </div>
    </button>
  );
}
