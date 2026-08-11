import React from "react";
import type { ChangeCategory } from "@shared/types/change";
import { CheckIcon } from "@ui/components/Icons";

export function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-label">{sub}</div>}
    </div>
  );
}

const CATEGORY_BADGE_CLASS: Record<ChangeCategory, string> = {
  added: "badge-success",
  removed: "badge-critical",
  modified: "badge-suggestion",
  deprecated: "badge-neutral",
};

const CATEGORY_LABEL: Record<ChangeCategory, string> = {
  added: "Added",
  removed: "Removed",
  modified: "Changed",
  deprecated: "Deprecated",
};

export function CategoryBadge({ category }: { category: ChangeCategory }) {
  return <span className={`badge ${CATEGORY_BADGE_CLASS[category]}`}>{CATEGORY_LABEL[category]}</span>;
}

export function BreakingBadge({ breaking, potential }: { breaking: boolean; potential: boolean }) {
  if (breaking) return <span className="badge badge-critical">Breaking</span>;
  if (potential) return <span className="badge badge-warning">Potential breaking</span>;
  return null;
}

export function OptionCard({
  icon,
  title,
  description,
  selected,
  onSelect,
  variant = "checkbox",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
  variant?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      className={`option-card${selected ? " option-card-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="option-card-icon">{icon}</span>
      <span className="option-card-text">
        <span className="option-card-title">{title}</span>
        <span className="option-card-desc">{description}</span>
      </span>
      <span className={`option-card-indicator${variant === "radio" ? " option-card-indicator-radio" : ""}`}>
        {selected && (variant === "radio" ? (
          <span className="option-card-radio-dot" />
        ) : (
          <CheckIcon style={{ width: 12, height: 12 }} />
        ))}
      </span>
    </button>
  );
}

export function Banner({
  kind,
  children,
  onDismiss,
  style,
}: {
  kind: "info" | "error";
  children: React.ReactNode;
  onDismiss?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`banner banner-${kind}`} style={style}>
      <span>{children}</span>
      {onDismiss && (
        <button className="banner-close" onClick={onDismiss} aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}
