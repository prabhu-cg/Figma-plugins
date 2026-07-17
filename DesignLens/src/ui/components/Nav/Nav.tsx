import {
  AuditIcon,
  ComponentsIcon,
  DashboardIcon,
  DocumentationIcon,
  LogoMark,
  ReportsIcon,
  SettingsIcon,
  VariablesIcon
} from "../Icons";
import type { View } from "../../App";

type NavIcon = (props: { className?: string }) => JSX.Element;

const MAIN_NAV_ITEMS: { id: View; label: string; icon: NavIcon }[] = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "audit", label: "Audit", icon: AuditIcon },
  { id: "components", label: "Components", icon: ComponentsIcon },
  { id: "variables", label: "Variables", icon: VariablesIcon },
  { id: "documentation", label: "Documentation", icon: DocumentationIcon },
  { id: "reports", label: "Reports", icon: ReportsIcon }
];

const SETTINGS_ITEM: { id: View; label: string; icon: NavIcon } = { id: "settings", label: "Settings", icon: SettingsIcon };

interface NavProps {
  active: View;
  onSelect: (view: View) => void;
  disabled: boolean;
}

export function Nav({ active, onSelect, disabled }: NavProps) {
  function renderItem(item: { id: View; label: string; icon: NavIcon }) {
    const Icon = item.icon;
    const isDisabled = disabled && item.id !== "dashboard" && item.id !== "settings";
    return (
      <button
        key={item.id}
        className={`nav-item${active === item.id ? " active" : ""}`}
        onClick={() => onSelect(item.id)}
        disabled={isDisabled}
        style={isDisabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
      >
        <Icon className="icon" />
        {item.label}
      </button>
    );
  }

  return (
    <nav className="nav">
      <div className="nav-brand">
        <LogoMark className="nav-brand-mark" />
        <div className="nav-brand-text">
          <span className="nav-brand-name">
            Design<span className="nav-brand-name-accent">Lens</span>
          </span>
          <span className="nav-brand-tagline">Your Design System Auditor</span>
        </div>
      </div>
      {MAIN_NAV_ITEMS.map(renderItem)}
      <div className="nav-spacer" />
      {renderItem(SETTINGS_ITEM)}
    </nav>
  );
}
