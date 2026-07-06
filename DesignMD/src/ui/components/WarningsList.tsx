interface WarningsListProps {
  warnings: string[];
}

export function WarningsList({ warnings }: WarningsListProps) {
  if (warnings.length === 0) return null;
  return (
    <details className="dmd-warnings">
      <summary>
        {warnings.length} warning{warnings.length === 1 ? '' : 's'}
      </summary>
      <ul>
        {warnings.map((w, i) => (
          <li key={i}>{w}</li>
        ))}
      </ul>
    </details>
  );
}
