export type SeparatorType = 'slash' | 'dot' | 'space' | 'camelCase' | 'PascalCase' | 'unknown';

export interface ParsedTokenName {
  raw: string;
  segments: string[];
  domain: string;
  category: string;
  scale: string;
  label: string;
  separator: SeparatorType;
}

function detectSeparator(name: string): SeparatorType {
  if (name.includes('/')) return 'slash';
  if (name.includes('.')) return 'dot';
  if (name.includes(' ')) return 'space';
  if (/^[A-Z]/.test(name) && /[A-Z]/.test(name.slice(1))) return 'PascalCase';
  if (/^[a-z]/.test(name) && /[A-Z]/.test(name)) return 'camelCase';
  return 'unknown';
}

function split(name: string, sep: SeparatorType): string[] {
  switch (sep) {
    case 'slash': return name.split('/').map(s => s.trim()).filter(Boolean);
    case 'dot':   return name.split('.').map(s => s.trim()).filter(Boolean);
    case 'space': return name.split(' ').map(s => s.trim()).filter(Boolean);
    case 'camelCase':
    case 'PascalCase':
      return name.replace(/([A-Z])/g, ' $1').trim().split(' ').filter(Boolean);
    default:
      return [name];
  }
}

function humanize(segments: string[]): string {
  return segments
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');
}

export function parseTokenName(name: string): ParsedTokenName {
  const separator = detectSeparator(name);
  const segments = split(name, separator);
  const labelSegments = segments.length > 1 ? segments.slice(1) : segments;

  return {
    raw: name,
    segments,
    domain: segments[0]?.toLowerCase() ?? '',
    category: segments[1]?.toLowerCase() ?? '',
    scale: segments[2]?.toLowerCase() ?? '',
    label: humanize(labelSegments),
    separator,
  };
}
