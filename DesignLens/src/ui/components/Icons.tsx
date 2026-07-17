import type { SVGProps } from "react";

export const LogoMark = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M107.876 0C167.455 0 215.752 46.9835 215.752 104.941C215.752 132.444 204.875 157.475 187.078 176.188C190.982 175.151 195.332 176.153 198.357 179.172C202.408 183.214 202.68 189.474 199.231 193.816C206.709 189.385 216.601 190.387 222.972 196.746L250.545 224.261C257.952 231.653 257.797 243.487 250.198 250.693C242.599 257.899 230.434 257.748 223.027 250.356L195.454 222.839C189.028 216.426 188.294 206.671 193.174 199.494C188.641 202.542 182.378 202.059 178.403 198.093C175.216 194.912 174.367 190.357 175.83 186.445C157.281 201.098 133.633 209.881 107.876 209.881C48.2978 209.881 0 162.898 0 104.941C0 46.9835 48.2978 0 107.876 0ZM107.876 12.3915C55.3329 12.3915 12.7382 53.8272 12.7382 104.941C12.7382 156.054 55.3329 197.49 107.876 197.49C160.42 197.49 203.014 156.054 203.014 104.941C203.014 53.8272 160.42 12.3915 107.876 12.3915Z"
      fill="currentColor"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M162.411 92.9364C167.688 92.9364 171.965 97.0973 171.965 102.23V106.877C171.965 112.01 167.688 116.17 162.411 116.17H54.1372C48.8608 116.17 44.5835 112.01 44.5835 106.877V102.23C44.5835 97.0973 48.8608 92.9364 54.1372 92.9364H162.411ZM156.191 101.456C155.509 101.456 155.143 102.235 155.588 102.737L159.393 107.019C159.72 107.387 160.31 107.374 160.62 106.993L164.103 102.71C164.516 102.203 164.144 101.456 163.479 101.456H156.191Z"
      fill="var(--color-primary)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M162.411 61.9576C167.688 61.9576 171.965 66.1185 171.965 71.2512V75.898C171.965 81.0308 167.688 85.1917 162.411 85.1917H54.1372C48.8608 85.1917 44.5835 81.0308 44.5835 75.898V71.2512C44.5835 66.1185 48.8608 61.9576 54.1372 61.9576H162.411ZM156.191 70.4767C155.509 70.4767 155.143 71.2562 155.588 71.7579L159.393 76.0402C159.72 76.4078 160.31 76.3954 160.62 76.0145L164.103 71.7315C164.516 71.2237 164.144 70.4767 163.479 70.4767H156.191Z"
      fill="var(--color-primary)"
    />
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M162.411 123.915C167.688 123.915 171.965 128.076 171.965 133.209V137.856C171.965 142.988 167.688 147.149 162.411 147.149H54.1372C48.8608 147.149 44.5835 142.988 44.5835 137.856V133.209C44.5835 128.076 48.8608 123.915 54.1372 123.915H162.411ZM156.191 132.434C155.509 132.434 155.143 133.214 155.588 133.716L159.393 137.998C159.72 138.365 160.31 138.353 160.62 137.972L164.103 133.689C164.516 133.181 164.144 132.434 163.479 132.434H156.191Z"
      fill="var(--color-primary)"
    />
  </svg>
);

const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...props
});

export const DashboardIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const AuditIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

export const ComponentsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <polygon points="12 3 21 8 12 13 3 8 12 3" />
    <polyline points="3 13 12 18 21 13" />
    <polyline points="3 17.5 12 22.5 21 17.5" />
  </svg>
);

export const VariablesIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <line x1="4" y1="6" x2="20" y2="6" />
    <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
    <line x1="4" y1="18" x2="20" y2="18" />
    <circle cx="11" cy="18" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const DocumentationIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M6 3h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4" />
    <line x1="8" y1="12" x2="16" y2="12" />
    <line x1="8" y1="16" x2="13" y2="16" />
  </svg>
);

export const ReportsIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 20V10" />
    <path d="M10 20V4" />
    <path d="M16 20v-7" />
    <path d="M20 20H4" />
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

export const TargetIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="12" cy="12" r="0.5" fill="currentColor" />
  </svg>
);
