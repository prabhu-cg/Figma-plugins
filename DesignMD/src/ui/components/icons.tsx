interface IconProps {
  className?: string;
}

const base = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function DocumentIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 16.5h6M9 9.5h2" />
    </svg>
  );
}

export function StackIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="4" y="4" width="7" height="7" rx="1.2" />
      <rect x="13" y="4" width="7" height="7" rx="1.2" />
      <rect x="4" y="13" width="7" height="7" rx="1.2" />
      <rect x="13" y="13" width="7" height="7" rx="1.2" />
    </svg>
  );
}

export function BracesIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M8 4c-1.7 0-2.5.9-2.5 2.4v2.2c0 1.3-.4 2-1.5 2.4 1.1.4 1.5 1.1 1.5 2.4v2.2c0 1.5.8 2.4 2.5 2.4" />
      <path d="M16 4c1.7 0 2.5.9 2.5 2.4v2.2c0 1.3.4 2 1.5 2.4-1.1.4-1.5 1.1-1.5 2.4v2.2c0 1.5-.8 2.4-2.5 2.4" />
    </svg>
  );
}

export function HashIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.5 3.5 7 20.5M17 3.5l-2.5 17M4 8.5h16M3 15.5h16" />
    </svg>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="4" width="17" height="4.5" rx="1" />
      <path d="M5.5 8.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8.5" />
      <path d="M10 12.5h4" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base} width={13} height={13} strokeWidth={2.4} className={className}>
      <path d="M5 12.5 9.5 17 19 6.5" />
    </svg>
  );
}
