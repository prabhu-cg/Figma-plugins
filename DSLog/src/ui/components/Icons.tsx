import type { SVGProps } from "react";

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props,
});

export const OverviewIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const TrackIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" />
  </svg>
);

export const ChangesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M3 13h4l2-7 4 14 2-7h6" />
  </svg>
);

export const ReleasesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3l8 8-9 9-8-8V4h8z" />
    <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);

export const HistoryIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <polyline points="3 4 3 9 8 9" />
    <polyline points="12 7 12 12 16 14" />
  </svg>
);

export const HelpIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.2a2.5 2.5 0 0 1 4.9.8c0 1.7-2.4 2-2.4 3.5" />
    <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
  </svg>
);

export const SettingsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.04-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.56-1.04 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.56 1.04z" />
  </svg>
);

export const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export const ChevronRightIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <polyline points="9 6 15 12 9 18" />
  </svg>
);

export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

export const AlertIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3l9.5 17H2.5L12 3z" />
    <line x1="12" y1="10" x2="12" y2="14" />
    <circle cx="12" cy="17.5" r="0.5" fill="currentColor" />
  </svg>
);

export const CheckCircleIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M8 12l3 3 5-6" />
  </svg>
);

export const DownloadIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3v12" />
    <polyline points="7 10 12 15 17 10" />
    <path d="M4 19h16" />
  </svg>
);

export const CopyIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="8" y="8" width="12" height="12" rx="1.5" />
    <path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8" />
  </svg>
);

export const PlusIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

export const CheckIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <polyline points="5 13 10 18 19 7" />
  </svg>
);

export const ComponentGlyphIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3l9 9-9 9-9-9 9-9z" />
  </svg>
);

export const TokenGlyphIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <circle cx="9" cy="7" r="1.8" fill="currentColor" stroke="none" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="11" cy="17" r="1.8" fill="currentColor" stroke="none" />
  </svg>
);

export const ChecklistIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M9 3.5V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v.5" />
    <polyline points="8.5 11 10 12.5 13 9.5" />
    <line x1="9" y1="16" x2="15" y2="16" />
  </svg>
);

export const SelectionIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" strokeDasharray="3.2 3.2" />
    <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const PageGlyphIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <line x1="8.5" y1="8" x2="15.5" y2="8" />
    <line x1="8.5" y1="12" x2="15.5" y2="12" />
    <line x1="8.5" y1="16" x2="13" y2="16" />
  </svg>
);

export const DocumentStackIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="7" y="3" width="14" height="14" rx="1.5" />
    <path d="M3 7v13a1 1 0 0 0 1 1h13" />
  </svg>
);
