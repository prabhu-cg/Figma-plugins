import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@shared/constants/brand";
import { useTheme, type ThemePreference } from "@ui/state/useTheme";

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: "system", label: "Match Figma" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function SettingsPage() {
  const { project, send } = useProjectState();
  const { theme, setTheme } = useTheme();
  if (!project) return null;

  const settings = project.settings;

  const update = (patch: Partial<typeof settings>) => {
    send({ type: "update-settings", settings: { ...settings, ...patch } });
  };

  return (
    <div className="view">
      <div className="view-header">
        <div>
          <div className="view-title">Settings</div>
          <div className="view-subtitle">Appearance, tracking, and about DSLog</div>
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
                onClick={() => setTheme(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Tracking
          </div>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.tracking.components}
              onChange={(e) => update({ tracking: { ...settings.tracking, components: e.target.checked } })}
            />
            <span style={{ fontSize: 12.5 }}>Components</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={settings.tracking.tokens}
              onChange={(e) => update({ tracking: { ...settings.tracking, tokens: e.target.checked } })}
            />
            <span style={{ fontSize: 12.5 }}>Tokens</span>
          </label>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            Change detection
          </div>
          <div className="flex gap-3 wrap">
            {(
              [
                ["structural", "Structural changes"],
                ["tokens", "Token changes"],
                ["properties", "Property changes"],
                ["styles", "Style changes"],
              ] as const
            ).map(([key, label]) => (
              <label className="checkbox-row" key={key}>
                <input
                  type="checkbox"
                  checked={settings.detection[key]}
                  onChange={(e) => update({ detection: { ...settings.detection, [key]: e.target.checked } })}
                />
                <span style={{ fontSize: 12.5 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Storage
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5 }}>
            Local only — baselines and releases are stored inside this Figma file.
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}>
            Privacy
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5 }}>
            No data leaves Figma. No network access, no telemetry, no account required.
          </div>
        </div>

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <div className="card-title" style={{ marginBottom: 12 }}>
            About {PRODUCT_NAME}
          </div>
          <div className="text-secondary" style={{ fontSize: 12.5, lineHeight: 1.8 }}>
            {PRODUCT_NAME} is a free, local-first {PRODUCT_TAGLINE.toLowerCase()}. Every scan, diff, and
            classification runs entirely inside this Figma plugin sandbox — no data leaves your file, no network
            requests are made, and no AI or paid APIs are used. Baselines, releases, and change history are stored
            locally in this file so they persist across plugin sessions.
          </div>
        </div>
      </div>
    </div>
  );
}
