import React from "react";
import { useProjectState } from "@ui/state/ProjectContext";
import { PRODUCT_NAME, PRODUCT_TAGLINE } from "@shared/constants/brand";

export function SettingsPage() {
  const { project, send } = useProjectState();
  if (!project) return null;

  const settings = project.settings;

  const update = (patch: Partial<typeof settings>) => {
    send({ type: "update-settings", settings: { ...settings, ...patch } });
  };

  return (
    <div className="dslog-page">
      <div className="dslog-section">
        <div className="dslog-label">Tracking</div>
        <label className="dslog-checkbox">
          <input
            type="checkbox"
            checked={settings.tracking.components}
            onChange={(e) => update({ tracking: { ...settings.tracking, components: e.target.checked } })}
          />
          <span>Components</span>
        </label>
        <label className="dslog-checkbox">
          <input
            type="checkbox"
            checked={settings.tracking.tokens}
            onChange={(e) => update({ tracking: { ...settings.tracking, tokens: e.target.checked } })}
          />
          <span>Tokens</span>
        </label>
      </div>

      <div className="dslog-section">
        <div className="dslog-label">Change detection</div>
        {(
          [
            ["structural", "Structural changes"],
            ["tokens", "Token changes"],
            ["properties", "Property changes"],
            ["styles", "Style changes"],
          ] as const
        ).map(([key, label]) => (
          <label className="dslog-checkbox" key={key}>
            <input
              type="checkbox"
              checked={settings.detection[key]}
              onChange={(e) => update({ detection: { ...settings.detection, [key]: e.target.checked } })}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="dslog-section">
        <div className="dslog-label">Storage</div>
        <p className="dslog-hint">Local only — baselines and releases are stored inside this Figma file.</p>
      </div>

      <div className="dslog-section">
        <div className="dslog-label">Privacy</div>
        <p className="dslog-hint">No data leaves Figma. No network access, no telemetry, no account required.</p>
      </div>

      <div className="dslog-section">
        <div className="dslog-label">About</div>
        <p className="dslog-hint">
          {PRODUCT_NAME} — {PRODUCT_TAGLINE}
        </p>
      </div>
    </div>
  );
}
