import React from "react";
import type { ChangeCategory, ChangeSeverity } from "@shared/types/change";

export function CategoryBadge({ category }: { category: ChangeCategory }) {
  return <span className={`dslog-badge dslog-badge--${category}`}>{category}</span>;
}

export function SeverityBadge({ severity }: { severity: ChangeSeverity }) {
  return <span className={`dslog-badge dslog-badge--sev-${severity}`}>{severity}</span>;
}

export function BreakingBadge({ breaking, potential }: { breaking: boolean; potential: boolean }) {
  if (breaking) return <span className="dslog-badge dslog-badge--breaking">Breaking</span>;
  if (potential) return <span className="dslog-badge dslog-badge--potential">Potential breaking</span>;
  return null;
}
