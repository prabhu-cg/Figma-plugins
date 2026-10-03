import React from "react";
import type { Change } from "@shared/types/change";
import { getEffectiveClassification } from "@shared/utils/classification";
import { CategoryBadge, BreakingBadge, ReviewStateBadge } from "./Shared";

export function changeItemDomId(changeId: string): string {
  return `change-item-${changeId}`;
}

export function ChangeListItem({
  change,
  selected,
  onSelect,
  checked,
  onToggleCheck,
}: {
  change: Change;
  selected: boolean;
  onSelect: () => void;
  /** When provided (with onToggleCheck), renders a bulk-selection checkbox (spec §14). */
  checked?: boolean;
  onToggleCheck?: () => void;
}) {
  const effective = getEffectiveClassification(change);
  return (
    <div className="flex items-center gap-2" style={{ width: "100%" }}>
      {onToggleCheck && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onChange={onToggleCheck}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${change.entityName} change for bulk review`}
        />
      )}
      <button
        id={changeItemDomId(change.id)}
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={`card change-item${selected ? " is-selected" : ""}${change.reviewState === "unreviewed" ? "" : " is-done"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CategoryBadge category={effective.category} />
            <BreakingBadge breaking={effective.breaking} potential={effective.potentialBreaking} />
          </div>
          {change.reviewState !== "unreviewed" && <ReviewStateBadge state={change.reviewState} />}
        </div>
        <div className="change-item-name">{change.entityName}</div>
        <div className="text-secondary" style={{ fontSize: 12 }}>
          {change.summary}
        </div>
      </button>
    </div>
  );
}
