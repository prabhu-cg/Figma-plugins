import React from "react";
import type { PageId } from "@ui/App";
import { Logo } from "./Logo";
import { ChangesIcon, HistoryIcon, OverviewIcon, ReleasesIcon, SettingsIcon, TrackIcon } from "./Icons";
import { SearchBar } from "./SearchBar";
import { PRODUCT_TAGLINE } from "@shared/constants/brand";

type NavIconComponent = (props: { className?: string }) => JSX.Element;

const MAIN_NAV_ITEMS: { id: PageId; label: string; icon: NavIconComponent }[] = [
  { id: "overview", label: "Overview", icon: OverviewIcon },
  { id: "track", label: "Track", icon: TrackIcon },
  { id: "changes", label: "Changes", icon: ChangesIcon },
  { id: "releases", label: "Releases", icon: ReleasesIcon },
  { id: "history", label: "History", icon: HistoryIcon },
];

const SETTINGS_ITEM: { id: PageId; label: string; icon: NavIconComponent } = {
  id: "settings",
  label: "Settings",
  icon: SettingsIcon,
};

export function Nav({ active, onSelect }: { active: PageId; onSelect: (page: PageId) => void }) {
  function renderItem(item: { id: PageId; label: string; icon: NavIconComponent }) {
    const Icon = item.icon;
    return (
      <button
        key={item.id}
        className={`nav-item${active === item.id ? " active" : ""}`}
        onClick={() => onSelect(item.id)}
      >
        <Icon className="icon" />
        {item.label}
      </button>
    );
  }

  return (
    <nav className="nav">
      <div className="nav-brand">
        <Logo size={26} />
        <div className="nav-brand-text">
          <span className="nav-brand-name">
            DS<span className="nav-brand-name-accent">Log</span>
          </span>
          <span className="nav-brand-tagline">{PRODUCT_TAGLINE}</span>
        </div>
      </div>
      <div style={{ padding: "0 var(--space-2) var(--space-2)" }}>
        <SearchBar onNavigate={onSelect} />
      </div>
      {MAIN_NAV_ITEMS.map(renderItem)}
      <div className="nav-spacer" />
      {renderItem(SETTINGS_ITEM)}
    </nav>
  );
}
