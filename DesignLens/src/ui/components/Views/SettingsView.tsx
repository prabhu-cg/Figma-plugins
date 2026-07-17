import type { WcagLevel } from "@shared/types";
import type { ThemePreference } from "../../state/useTheme";

interface SettingsViewProps {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  wcagLevel: WcagLevel;
  onWcagLevelChange: (level: WcagLevel) => void;
  onRescan: () => void;
  hasResult: boolean;
}

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "system", label: "Match Figma" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" }
];

const WCAG_OPTIONS: { id: WcagLevel; label: string; description: string }[] = [
  { id: "AA", label: "WCAG AA", description: "4.5:1 text, 3:1 large text & UI components — the standard compliance bar." },
  { id: "AAA", label: "WCAG AAA", description: "7:1 text, 4.5:1 large text — for products with a stricter accessibility target." }
];

export function SettingsView({ theme, onThemeChange, wcagLevel, onWcagLevelChange, onRescan, hasResult }: SettingsViewProps) {
  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Settings</div>
          <div className="view-subtitle">Appearance, scanning, and about DesignLens</div>
        </div>
      </div>

      <div className="grid grid-cols-2">
        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Appearance
          </div>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                className={`btn btn-sm ${theme === opt.id ? "btn-primary" : "btn-secondary"}`}
                onClick={() => onThemeChange(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Scan
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5, marginBottom: 12 }}>
            Re-scan this file to refresh the audit after making changes to components, variants, or variables.
          </div>
          <button className="btn btn-primary btn-sm" onClick={onRescan}>
            {hasResult ? "Rescan file" : "Start audit"}
          </button>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            Contrast standard
          </div>
          <div className="flex gap-3 wrap">
            {WCAG_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => onWcagLevelChange(opt.id)}
                className="card"
                style={{
                  flex: "1 1 220px",
                  textAlign: "left",
                  cursor: "pointer",
                  border: `1px solid ${wcagLevel === opt.id ? "var(--color-primary)" : "var(--color-border)"}`
                }}
              >
                <div className="flex items-center justify-between">
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{opt.label}</span>
                  {wcagLevel === opt.id && <span className="badge badge-success">Active</span>}
                </div>
                <div className="text-secondary" style={{ fontSize: 12, marginTop: 6 }}>
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
          <div className="text-tertiary" style={{ fontSize: 11.5, marginTop: 10 }}>
            Applies to all contrast checks on the next scan.
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            About DesignLens
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
            DesignLens is a free, local design system auditor. Every scan and every audit rule runs entirely inside
            this Figma plugin sandbox — no data leaves your file, no network requests are made, and no AI or paid
            APIs are used. Audit rules are organized as independent, pluggable modules covering visual quality,
            contrast, typography, spacing, tokens, components, states, accessibility, documentation, governance, and
            deprecated components. Scan results, health-score trend, and resolved/ignored issue status are saved
            locally on this machine (per file) so they persist across plugin sessions.
          </div>
        </div>
      </div>
    </div>
  );
}
