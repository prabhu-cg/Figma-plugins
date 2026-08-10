import React from "react";
import type { PageId } from "@ui/App";

const NAV_ITEMS: Array<{ id: PageId; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "track", label: "Track" },
  { id: "changes", label: "Changes" },
  { id: "releases", label: "Releases" },
  { id: "settings", label: "Settings" },
];

export function NavBar({ current, onNavigate }: { current: PageId; onNavigate: (page: PageId) => void }) {
  return (
    <nav className="dslog-nav">
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`dslog-nav__item ${current === item.id ? "is-active" : ""}`}
          onClick={() => onNavigate(item.id)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
