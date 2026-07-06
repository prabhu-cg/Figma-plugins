interface ExportSettingsProps {
  baseName: string;
  onBaseNameChange: (value: string) => void;
}

export function ExportSettings({ baseName, onBaseNameChange }: ExportSettingsProps) {
  return (
    <section className="dmd-section">
      <h2 className="dmd-section-title">Export settings</h2>
      <label className="dmd-field">
        <span>Export file name</span>
        <input
          type="text"
          value={baseName}
          onChange={(e) => onBaseNameChange(e.target.value)}
          placeholder="designmd-export"
        />
      </label>
    </section>
  );
}
