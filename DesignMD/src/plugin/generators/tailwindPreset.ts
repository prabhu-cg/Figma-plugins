import { kebabCase, nameHasHint } from '@shared/naming';
import type { DesignSystem, StyleToken, VariableToken } from '@shared/types';
import type { GeneratedFile } from '@shared/messages';
import { buildCssVariableMaps, modeOverrides, type CssVariableMaps } from './cssVariables';
import { buildTokenTree, type TokenTreeEntry } from './tokenTree';

type Tree = Record<string, unknown>;

const isString = (v: unknown): boolean => typeof v === 'string';

/** Leading path segments that only restate the bucket a token already lives in. */
const REDUNDANT_PREFIXES: Record<string, string[]> = {
  colors: ['color', 'colors', 'semantic', 'semantics'],
  spacing: ['spacing', 'space', 'spacings'],
  borderRadius: ['radius', 'radii', 'border-radius', 'corner-radius'],
  fontSize: ['font-size', 'fontsize', 'size', 'font', 'text'],
  fontFamily: ['font-family', 'family', 'font'],
  boxShadow: ['shadow', 'shadows', 'elevation', 'effect', 'effects'],
};

function keyPath(path: string[], bucket: keyof typeof REDUNDANT_PREFIXES): string[] {
  const segments = path.map(kebabCase).filter(Boolean);
  const prefixes = REDUNDANT_PREFIXES[bucket];
  while (segments.length > 1 && prefixes.includes(segments[0])) segments.shift();
  return segments;
}

function tree(entries: TokenTreeEntry<string>[]): Tree {
  return buildTokenTree(entries, isString) as Tree;
}

const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const ALIAS = /^var\((--[^)]+)\)$/;

const rgbName = (cssName: string) => `${cssName}-rgb`;

/**
 * Space-separated RGB channels ("51 102 255") for a variable, or a reference to another
 * variable's channels when it is an alias. Tailwind needs bare channels to apply opacity
 * modifiers like `bg-primary/50`. Translucent colors (8-digit hex) have none.
 */
function rgbValue(
  name: string,
  valueOf: (name: string) => string | undefined,
  depth = 0,
): string | undefined {
  const value = valueOf(name);
  if (value === undefined || depth > 10) return undefined;
  const hex = HEX6.exec(value);
  if (hex)
    return hex
      .slice(1)
      .map((h) => parseInt(h, 16))
      .join(' ');
  const alias = ALIAS.exec(value);
  if (alias && rgbValue(alias[1], valueOf, depth + 1) !== undefined) {
    return `var(${rgbName(alias[1])})`;
  }
  return undefined;
}

function rgbChannelVars(
  names: string[],
  valueOf: (name: string) => string | undefined,
): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const name of names) {
    const channels = rgbValue(name, valueOf);
    if (channels !== undefined) vars[rgbName(name)] = channels;
  }
  return vars;
}

/** `:root` and per-mode blocks of "<name>-rgb" variables, in the shape Tailwind's addBase takes. */
function rgbBaseStyles(maps: CssVariableMaps): Record<string, unknown> {
  const rootVars = rgbChannelVars(Object.keys(maps.root), (n) => maps.root[n]);
  const base: Record<string, unknown> = { ':root': rootVars };
  for (const { slug, modeName, vars } of modeOverrides(maps)) {
    const modeValues = maps.modes[modeName] ?? {};
    const valueOf = (n: string) => modeValues[n] ?? maps.root[n];
    const modeVars = Object.fromEntries(
      Object.entries(rgbChannelVars(Object.keys(vars), valueOf)).filter(
        ([name, value]) => rootVars[name] !== value,
      ),
    );
    if (Object.keys(modeVars).length === 0) continue;
    base[`[data-theme="${slug}"]`] = modeVars;
    if (slug === 'dark') {
      base['@media (prefers-color-scheme: dark)'] = { ':root:not([data-theme="light"])': modeVars };
    }
  }
  return base;
}

/**
 * tailwind.tokens.js: a Tailwind preset whose theme values are `var(--token)` references, so the
 * preset stays tiny and light/dark modes switch through tokens.css rather than rebuilding CSS.
 * Only tokens that exist in the generated CSS variables are referenced.
 */
export function generateTailwindPreset(ds: DesignSystem): GeneratedFile {
  const maps = buildCssVariableMaps(ds);
  const { root } = maps;
  const ref = (cssName: string) => (cssName in root ? `var(${cssName})` : undefined);
  const rgbBase = rgbBaseStyles(maps);
  const rootRgb = rgbBase[':root'] as Record<string, string>;
  // Opaque colors use channel variables so Tailwind's opacity modifiers work (bg-primary/50).
  const colorRef = (cssName: string) =>
    rgbName(cssName) in rootRgb ? `rgb(var(${rgbName(cssName)}) / <alpha-value>)` : ref(cssName);

  const entriesFor = (
    bucket: keyof typeof REDUNDANT_PREFIXES,
    variables: VariableToken[],
    format: (cssName: string) => string | undefined = ref,
  ): TokenTreeEntry<string>[] =>
    variables.flatMap((v) => {
      const value = format(v.cssName);
      return value ? [{ path: keyPath(v.path, bucket), leaf: value }] : [];
    });
  const styleEntries = (
    bucket: keyof typeof REDUNDANT_PREFIXES,
    styles: StyleToken[],
    cssName: (s: StyleToken) => string,
    format: (cssName: string) => string | undefined = ref,
  ): TokenTreeEntry<string>[] =>
    styles.flatMap((s) => {
      const value = format(cssName(s));
      return value ? [{ path: keyPath(s.path, bucket), leaf: value }] : [];
    });

  const colorVariables = ds.variables.filter(
    (v) => v.resolvedType === 'COLOR' && (v.category === 'color' || v.category === 'semantic'),
  );
  const colors =
    colorVariables.length > 0
      ? tree(entriesFor('colors', colorVariables, colorRef))
      : tree(styleEntries('colors', ds.styles.color, (s) => s.cssName, colorRef));

  const spacingVariables = ds.variables.filter((v) => v.category === 'spacing');
  const isRadius = (v: VariableToken) =>
    v.scopes.includes('CORNER_RADIUS') || nameHasHint(v.name, ['radius', 'radii']);
  const spacing = tree(
    entriesFor(
      'spacing',
      spacingVariables.filter((v) => !isRadius(v)),
    ),
  );
  const borderRadius = tree(entriesFor('borderRadius', spacingVariables.filter(isRadius)));

  const typographyVariables = ds.variables.filter((v) => v.category === 'typography');
  const fontFamily = tree(
    entriesFor(
      'fontFamily',
      typographyVariables.filter(
        (v) => v.resolvedType === 'STRING' && v.scopes.includes('FONT_FAMILY'),
      ),
    ),
  );
  const fontSizeVariables = typographyVariables.filter(
    (v) =>
      v.resolvedType === 'FLOAT' &&
      (v.scopes.includes('FONT_SIZE') || nameHasHint(v.name, ['size'])),
  );
  const fontSize: Tree = tree(entriesFor('fontSize', fontSizeVariables));
  // Text styles only have CSS variables when the file defines no typography variables.
  if (typographyVariables.length === 0) {
    for (const s of ds.styles.text) {
      const size = ref(`${s.cssName}-font-size`);
      if (!size) continue;
      const details = Object.fromEntries(
        (
          [
            ['lineHeight', `${s.cssName}-line-height`],
            ['letterSpacing', `${s.cssName}-letter-spacing`],
            ['fontWeight', `${s.cssName}-font-weight`],
          ] as const
        ).flatMap(([prop, name]) => (ref(name) ? [[prop, ref(name)]] : [])),
      );
      const [first, ...rest] = keyPath(s.path, 'fontSize');
      // Text style names rarely nest more than once; flatten to a single Tailwind class name.
      fontSize[[first, ...rest].join('-')] = [size, details];
    }
  }

  const boxShadow = tree(styleEntries('boxShadow', ds.styles.effect, (s) => s.cssName));

  const extend: Record<string, Tree> = {
    colors,
    spacing,
    borderRadius,
    fontFamily,
    fontSize,
    boxShadow,
  };
  const theme = Object.fromEntries(
    Object.entries(extend).filter(([, v]) => Object.keys(v).length > 0),
  );

  const header =
    `// Generated by DesignMD from "${ds.metadata.fileName.replace(/\n/g, ' ')}" — do not edit by hand.\n` +
    '// Non-color values are CSS variables from tokens.css, so import that file too and switch modes with\n' +
    '// [data-theme="..."]. Colors use their own "<name>-rgb" channel variables (defined by the plugin\n' +
    '// below) so opacity modifiers like bg-primary/50 work.\n' +
    '// Usage: presets: [require("./tailwind.tokens.js")] in tailwind.config.js.\n';

  const config = JSON.stringify({ theme: { extend: theme } }, null, 2).replace(/\n}$/, '');
  const hasRgb = Object.keys(rootRgb).length > 0;
  const plugins = hasRgb
    ? `,\n  "plugins": [\n    plugin(({ addBase }) => {\n      addBase(${JSON.stringify(rgbBase, null, 2).replace(/\n/g, '\n      ')});\n    })\n  ]\n}`
    : '\n}';
  const prelude = hasRgb ? "const plugin = require('tailwindcss/plugin');\n\n" : '';

  return {
    path: 'tailwind.tokens.js',
    content: `${header}${prelude}module.exports = ${config}${plugins};\n`,
  };
}
