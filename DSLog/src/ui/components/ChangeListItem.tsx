import React, { memo } from "react";
import type { Change } from "@shared/types/change";
import { getEffectiveClassification } from "@shared/utils/classification";
import { CategoryBadge, BreakingBadge, ReviewStateBadge } from "./Shared";

export function changeItemDomId(changeId: string): string {
  return `change-item-${changeId}`;
}

/**
 * Memoised: a row re-renders only when its own change, selection or checkbox changes. That needs `onSelect` and
 * `onToggleCheck` to be stable functions of the id (not fresh closures per row), which is why they take the id.
 */
export const ChangeListItem = memo(function ChangeListItem({
  change,
  selected,
  onSelect,
  checked,
  onToggleCheck,
}: {
  change: Change;
  selected: boolean;
  onSelect: (changeId: string) => void;
  /** When provided (with onToggleCheck), renders a bulk-selection checkbox (spec §14). */
  checked?: boolean;
  onToggleCheck?: (changeId: string) => void;
}) {
  const effective = getEffectiveClassification(change);
  return (
    <div className="flex items-center gap-2" style={{ width: "100%" }}>
      {onToggleCheck && (
        <input
          type="checkbox"
          checked={checked ?? false}
          onChange={() => onToggleCheck(change.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${change.entityName} change for bulk review`}
        />
      )}
      <button
        id={changeItemDomId(change.id)}
        onClick={() => onSelect(change.id)}
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
});
