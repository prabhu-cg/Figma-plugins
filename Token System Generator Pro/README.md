# Token System Generator Pro

A free Figma plugin that scaffolds a complete design token system — color ramps, spacing, border radius, border width and typography — into Figma Variables and local styles in seconds, and exports it as JSON for developer handoff.

## Overview

Token System Generator Pro creates Figma Variable collections in a 2-tier (Global + Alias) or 3-tier (Global + Alias + Component) architecture. It can build a system from your brand colors, scaffold a starter system, or convert the paint and text styles already in your file. Everything runs locally in Figma: the plugin makes no network requests.

## Key features

**Three ways to start**
- **From Scratch** — enter brand colors and scale settings → complete token system
- **Starter System** — a ready-made system with a default palette, to edit in Figma
- **Smart Convert** — scans your local paint and text styles → token hierarchy

**Two architectures**
- **2-Tier** (Global → Alias) — for smaller systems
- **3-Tier** (Global → Alias → Component) — adds component-level color tokens

**What gets generated**
- **Color ramps** — 10 stops (50–900) per color, generated in [OKLCH](https://oklch.fyi/). Stop 500 is exactly your color; every other stop keeps its hue and moves in perceptually even lightness steps, with chroma easing off toward the light and dark ends (gamut-mapped to sRGB). Brand colors are named by hue (e.g. `cobalt`, `violet`); semantic colors use fixed names (`blue`, `green`, `red`, `amber`, `grey`).
- **Typography** — 13 levels (display-lg → xs) across 5 scale ratios (Major Second, Minor Third, Major Third, Perfect Fourth, √2). Each level has font size, line height, letter spacing, **paragraph spacing** and **font weight**. Displays and h1–h2 are bold, h3–h6 semibold, body regular. Use one font throughout, or optionally a second font for body copy (headings and displays keep the first).
- **Spacing** — 10 values from a configurable base unit
- **Border radius** — 7 values (none, sm, md, lg, xl, 2xl, full)
- **Border width** — 5 values (none, sm, md, lg, xl)
- **Local styles** (From Scratch and Starter) — a paint style per color stop and text styles (Display, Heading, Body copy) bound to the variables
- **JSON export** — all collections as JSON with alias references preserved, via Copy or Download

## How it works

When you open the plugin, a file with no variables goes straight to mode selection. If variables already exist you can export them to JSON or regenerate.

### From Scratch
1. Enter Primary, Secondary and Accent colors (required). Tertiary and the semantic colors (info, success, error, warning, neutral) are optional; a blank color is skipped.
2. Set the spacing base (1–32), border radius base (0–64), border width base (1–16), base font size (10–24) and a scale ratio.
3. Choose a font family (default Inter). Optionally tick **Use a different font for body copy** and choose a body font.
4. Choose 2-tier or 3-tier and click **Generate Tokens**.

### Starter System
Choose 2-tier or 3-tier. The plugin scaffolds a system from a curated default palette (9 OKLCH ramps), spacing base 4, radius base 4, border width base 1 and a Major Third type scale in Inter. Edit the values in Figma afterwards.

### Smart Convert
Reads your local paint styles and text styles, keeps them as they are, and builds variables from them. Colors are used as-is (no ramps are generated). See [Smart Convert](#smart-convert-1) below.

## Replacing existing tokens

Generating again **replaces what this plugin made**, and only that. The confirmation dialog lists exactly what will be deleted, with counts. Everything else in your file stays as it is.
- **Collections:** only the ones named `01 Global`, `02 Alias` and `03 Component`. Your other variable collections are never touched.
- **Styles (From Scratch and Starter):** paint styles named like a ramp stop (`cobalt/500`) and text styles named like the ones this plugin creates (`Heading/h1`, `Display/display-lg`, `Body copy/body`). Your own styles, such as `Brand/Primary`, are kept.
- **Smart Convert** keeps all your styles, since it reads them, and replaces only the three collections above.
- If the file has none of those, there is nothing to replace and no confirmation is shown.

Generation is **all or nothing**. The new tokens are built under temporary names first, and your existing tokens are only removed once the whole build has succeeded. If anything fails, everything the run created is removed and your file is left exactly as it was; the panel says so. If the plugin is closed mid-generation, the half-built items are removed too.

Smaller problems (a font without a requested weight, an old item that couldn't be removed) don't fail the run. They are listed as warnings on the done screen.

## Token architecture

### Global — raw primitives
- `color/<name>/50` … `/900` — brand colors by hue name (`color/cobalt/500`), semantic colors by fixed name (`color/blue/500`)
- `spacing/<px>`, `borderRadius/<px>`, `borderWidth/<px>` — named by pixel value
- `typography/font-family` — or `typography/font-family/heading` and `/body` when a second body font is chosen
- `typography/font-size/<level>`, `line-height/<level>`, `letter-spacing/<level>`, `paragraph-spacing/<level>` — all in px
- `typography/font-weight/regular`, `/semibold`, `/bold` — shared by the levels that use them

### Alias — semantic names that point at Global
- `color/primary|secondary|tertiary|accent/<stop>`
- `color/feedback/info|success|error|warning|neutral/<stop>`
- `borderRadius/none…full`, `borderWidth/none…xl`
- `typography/font-family` (or `/heading` + `/body`)
- `text/<level>/font-size`, `line-height`, `letter-spacing`, `paragraph-spacing`, `font-weight`

### Component (3-tier only) — points at Alias
- `text/default|subtle|disabled|inverse`
- `icon/default|subtle|disabled|inverse`
- `surface/primary|secondary|tertiary|accent` — one per brand color you provided (no `surface/tertiary` if Tertiary is blank)
- `border/default|subtle|disabled|inverse`

Component tokens reference Alias tokens, which reference Global tokens.

### Text styles
Text styles use the real style of the chosen font for each weight (for example Inter's "Semi Bold" or Playfair Display's "SemiBold"). If a font doesn't have the exact weight, the closest available style is used and a warning says so. If the chosen font isn't available, Helvetica is used (also with a warning). Italic styles are not generated.

## Smart Convert

Smart Convert reads your local styles and creates variables from them. It does not create or change any styles.

| Your local style | Global variable | Alias |
|---|---|---|
| `Red 500` or `red-500` | `color/red/500` | `color/<role>/500` (2-tier: `color/…`, 3-tier: `colors/…`) |
| `Heading/h1` | `typography/fontSize/heading/h1`, `lineHeight`, `letterSpacing`, `paragraphSpacing`, `fontWeight` | `text/heading/h1/fontSize` … `fontWeight` |

- Color families are grouped by name; the plugin picks primary, secondary, tertiary and accent families by position in a brightness-sorted list, and feedback colors from the darkest, lightest and primary families. This is a heuristic, so check the Alias layer afterwards.
- Font weight is read from each text style's font style name ("Bold" → 700, "Semi Bold" → 600). A style name it doesn't recognise becomes 400.
- For 3-tier it also creates a Component collection (text, icon, surface, border) from the 500 stops.
- With no local styles, or no solid color styles, it stops without changing anything.

## JSON export

The export mirrors the collections in your file. The three plugin collections become `global`, `alias` and `component`; any other collection you have gets a camelCase key from its name (`My Tokens` → `myTokens`). Every token is `{ value, type }`.

```json
{
  "global": {
    "color": { "cobalt": { "50": { "value": "#F0F5FF", "type": "color" } } },
    "spacing": { "4": { "value": "4px", "type": "dimension" } },
    "typography": {
      "fontFamily": { "value": "Inter", "type": "fontFamily" },
      "fontWeight": { "bold": { "value": 700, "type": "fontWeight" } }
    }
  },
  "alias": {
    "color": { "primary": { "50": { "value": "{global.color.cobalt.50}", "type": "color" } } }
  },
  "component": {
    "surface": { "primary": { "value": "{alias.color.primary.500}", "type": "color" } }
  }
}
```

- Names are camelCased (`font-size` → `fontSize`) and nested by `/`.
- Aliases resolve to `{collection.path.to.token}`, for example `{global.color.cobalt.50}`.
- **Units:** sizes are strings with a unit (`"4px"`, `"1.5px"`, `"-2.28px"`), so tools don't have to guess. Font weights are plain numbers (`700`). Numbers in collections the plugin didn't create stay plain numbers with type `number`.
- Types: `color`, `dimension`, `fontFamily`, `fontWeight`, `number`.
- Each typography value is its own token (not combined into one composite object).
- **Refresh JSON** re-exports the current variables without regenerating, so manual edits in Figma are included.

### Using it with Style Dictionary

The file is a valid Style Dictionary source. It uses the `value` / `type` format and `{path}` references, which work in Style Dictionary v3 and in the current v5. Every reference resolves, and the Starter, From Scratch and Smart Convert exports all build in both.

```js
// build.mjs — Style Dictionary v5
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'build/',
      files: [{ destination: 'tokens.css', format: 'css/variables' }],
    },
  },
});
await sd.buildAllPlatforms();
```

This produces CSS custom properties such as `--global-spacing-4: 4px;`, `--alias-color-primary-500: #3d6be8;` and `--global-typography-letter-spacing-display-lg: -7.4px;`. SCSS and JavaScript outputs work the same way.

Things to know:
- **All three layers are exported.** Names start with the layer (`--global-…`, `--alias-…`, `--component-…`). Most apps should use the Alias or Component layer; filter on `token.path[0]` in your config if you only want those.
- **Letter spacing is in pixels**, like every other size (for example `-7.4px` for display-lg), so it matches the Figma text style.
- **Font families** that contain spaces or digits (such as `Source Sans 3`) are quoted automatically by Style Dictionary v5. v3 leaves them unquoted, which isn't valid CSS, so quote them in your config if you use v3.
- Sizes stay in `px` with the default `css` group; add Style Dictionary's `size/rem` transform if you want rem.

## Privacy and safety

- The plugin makes no network requests (`networkAccess` is `none`) and uses no external services.
- It only reads and writes local variables and styles in the current file, and only replaces the collections and styles it created itself.
- It uses Figma's async APIs and `documentAccess: dynamic-page`.
- Inputs are validated both in the panel and again in the plugin. Names that come from your file (for example variable names such as `__proto__`) can't affect the plugin.

## Development

Built with TypeScript against the Figma Plugin API, bundled with esbuild into a single `code.js`. There are no runtime dependencies.

```bash
npm install
npm run build          # type-check, then bundle code.ts → code.js
npm run watch          # rebuild on change
npm test               # algorithm tests + generation tests (incl. failure injection)
npm run test:memory    # repeated-run heap and state check
npm run lint           # ESLint with the Figma plugin rules
```

In Figma: **Plugins → Development → Import plugin from manifest…** and choose `manifest.json`. Run `npm run build` first; Figma loads `code.js`.

### Project structure
- `code.ts` — plugin logic: generation, staging and rollback, messages, JSON export
- `algorithms.ts` — pure functions with no Figma API: OKLCH conversion and ramps, type scale, spacing, radius, font-weight matching
- `ui.html` — the panel: wizard screens, inputs, confirmation dialog, JSON view
- `tests/algorithms.test.js` — OKLCH conversions, ramps, type scale, font weights
- `tests/generation.test.js` + `tests/figma-mock.js` — run the real plugin against an in-memory Figma mock; include failure injection (a failed run must leave the file unchanged)
- `tests/memory.test.js` — heap and state across hundreds of runs
- `docs/superpowers/` — original planning documents (historical; the code is the source of truth)

## Limitations
- Only one set of values is generated (no light/dark modes yet).
- Italic text styles are not generated; text styles use upright weights.
- Smart Convert's alias mapping is a heuristic.
- No shadow, elevation, opacity or z-index tokens yet.

## Ideas for next
1. **Accessibility Validator** — WCAG AA/AAA contrast checks for semantic color pairs
2. **Dark Mode Generator** — a dark mode from the light palette
3. **Import from JSON** — Style Dictionary JSON back into Figma variables
4. **Token Health Audit** — flag duplicates, off-scale values and missing aliases
5. **Variable Scope Auto-Assignment** — set Figma scopes per token type
6. **Elevation/Shadow Scale**

## License

Free for all Figma plan tiers.
