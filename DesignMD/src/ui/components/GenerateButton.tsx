interface GenerateButtonProps {
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
}

export function GenerateButton({ onClick, disabled, busy }: GenerateButtonProps) {
  return (
    <button className="dmd-btn dmd-btn-primary dmd-btn-full" onClick={onClick} disabled={disabled}>
      {busy ? 'Generating…' : 'Generate'}
    </button>
  );
}
