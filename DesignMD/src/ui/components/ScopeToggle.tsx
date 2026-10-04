import type { ExtractionScope } from '@shared/types';

interface ScopeToggleProps {
  scope: ExtractionScope;
  onChange: (scope: ExtractionScope) => void;
  selectionCount: number;
  disabled: boolean;
  /** Scope of the data currently on screen; a mismatch means a rescan is needed. */
  scannedScope: ExtractionScope | null;
}

export function ScopeToggle({
  scope,
  onChange,
  selectionCount,
  disabled,
  scannedScope,
}: ScopeToggleProps) {
  const selectionUnavailable = selectionCount === 0;
  const needsRescan = scannedScope !== null && scannedScope !== scope;

  return (
    <fieldset className="dmd-scope" disabled={disabled}>
      <legend className="dmd-scope-legend">Scan</legend>
      <div className="dmd-segmented">
        <label className={`dmd-segment${scope === 'file' ? ' is-selected' : ''}`}>
          <input
            type="radio"
            name="dmd-scope"
            checked={scope === 'file'}
            onChange={() => onChange('file')}
          />
          <span>Whole file</span>
        </label>
        <label
          className={`dmd-segment${scope === 'selection' ? ' is-selected' : ''}${selectionUnavailable ? ' is-unavailable' : ''}`}
          title={selectionUnavailable ? 'Select layers in Figma first' : undefined}
        >
          <input
            type="radio"
            name="dmd-scope"
            checked={scope === 'selection'}
            disabled={selectionUnavailable}
            onChange={() => onChange('selection')}
          />
          <span>Selection{selectionCount > 0 ? ` (${selectionCount})` : ''}</span>
        </label>
      </div>
      <p className="dmd-scope-hint" role="status">
        {needsRescan
          ? 'Rescan to apply this scope.'
          : scope === 'selection'
            ? 'Components inside the selected layers. Variables and styles stay file-wide.'
            : 'Every component in the file.'}
      </p>
    </fieldset>
  );
}
