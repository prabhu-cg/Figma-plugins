import { RefreshIcon } from './icons';

interface HeaderProps {
  onRescan: () => void;
  rescanDisabled: boolean;
  showRescan: boolean;
}

export function Header({ onRescan, rescanDisabled, showRescan }: HeaderProps) {
  return (
    <header className="dmd-header">
      <div>
        <h1>DesignMD</h1>
        <p className="dmd-subtitle">
          Extract and document your design system from Figma in seconds
        </p>
      </div>
      {showRescan && (
        <button
          className="dmd-icon-btn"
          onClick={onRescan}
          disabled={rescanDisabled}
          aria-label="Rescan design system"
          title="Rescan"
        >
          <RefreshIcon />
        </button>
      )}
    </header>
  );
}
