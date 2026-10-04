/**
 * Shared naming utilities. Figma names are free text ("Color/Primary/500",
 * "Button/Large", "Spacing md"); these normalize them into consistent path
 * segments, CSS custom property names, and filesystem-safe file names so
 * every generator produces the same conventions.
 */

/** Split a Figma variable/style name into path segments on "/". */
export function toPathSegments(name: string): string[] {
  return name
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** kebab-case a single word/phrase: "Primary 500" -> "primary-500", "fontSize" -> "font-size" */
export function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** Lowercase word segments of a name, splitting on separators and camelCase: "fontSize/Base_2" -> font, size, base, 2. */
export function nameSegments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * True when any hint appears in `name` as whole word segments (an optional plural "s" is allowed).
 * Multi-word hints like "line-height" must match consecutive segments. Matching on segments rather
 * than substrings keeps "on" from hitting "button" and "type" from hitting "prototype".
 */
export function nameHasHint(name: string, hints: readonly string[]): boolean {
  const segments = nameSegments(name);
  return hints.some((hint) => {
    const words = nameSegments(hint);
    for (let start = 0; start + words.length <= segments.length; start++) {
      const matches = words.every((word, i) => {
        const segment = segments[start + i];
        return segment === word || (i === words.length - 1 && segment === `${word}s`);
      });
      if (matches) return true;
    }
    return false;
  });
}

/** Build a CSS custom property name from path segments, e.g. ["color","primary","500"] -> "--color-primary-500" */
export function toCssVarName(pathSegments: string[]): string {
  const slug = pathSegments.map(kebabCase).filter(Boolean).join('-');
  return `--${slug}`;
}

/** Build a filesystem-safe file name (no extension) from a component name. */
export function toFileSafeName(name: string): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  // No leading/trailing dots (hidden files, ".."), and never an empty file name.
  const pascal = cleaned
    .replace(/^[.\s]+|[.\s]+$/g, '')
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
  return pascal || 'Component';
}

const FONT_WEIGHT_KEYWORDS: Array<[RegExp, number]> = [
  [/thin|hairline/, 100],
  [/extra[\s-]?light|ultra[\s-]?light/, 200],
  [/light/, 300],
  [/medium/, 500],
  [/semi[\s-]?bold|demi[\s-]?bold/, 600],
  [/extra[\s-]?bold|ultra[\s-]?bold/, 800],
  [/black|heavy/, 900],
  [/bold/, 700],
];

/** Infer a numeric CSS font-weight from a Figma font style name ("Semi Bold Italic" -> 600). Defaults to 400. */
export function fontWeightFromStyle(style: string): number {
  const lower = style.toLowerCase();
  for (const [pattern, weight] of FONT_WEIGHT_KEYWORDS) {
    if (pattern.test(lower)) return weight;
  }
  return 400;
}

/** Convert an sRGBA (0-1 floats) color to a #rrggbb / #rrggbbaa hex string. */
export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  const toByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const toHexByte = (v: number) => toByte(v).toString(16).padStart(2, '0');
  const base = `#${toHexByte(r)}${toHexByte(g)}${toHexByte(b)}`;
  return a < 1 ? `${base}${toHexByte(a)}` : base;
}
