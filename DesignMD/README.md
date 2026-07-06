# DesignMD

A Figma plugin that deterministically extracts a design system — Variables, Styles, and
Components — into developer-ready documentation and token files. No AI, no backend, no
network access: everything runs locally inside the Figma plugin sandbox, and it's free
forever with no feature gating.

## What it generates

| File              | Contents                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `design.md`       | Overview, variable collections, color/typography/spacing/effect/grid tokens, component index, accessibility notes, naming conventions |
| `components/*.md` | One Markdown file per component/component set — variants, sizes, states, properties, token references, related components             |
| `tokens.json`     | Normalized, nested token export (DTCG-style `$type`/`$value`), grouped by color/typography/spacing/effect/grid/semantic/component     |
| `css-tokens.json` | CSS custom-property-ready export (`--color-primary-500`, etc.), including per-mode overrides                                          |

Variables are the source of truth; when a category has no variables (e.g. no color
variables), the corresponding Styles (Paint/Text/Effect/Grid) are used as a fallback and
the output notes that it did so.

## Architecture

```
src/
  shared/       Normalized DesignSystem schema + UI<->plugin message protocol (used by both sides)
  plugin/       Runs in the Figma plugin sandbox (src/plugin/main.ts -> dist/code.js)
    extraction/   Talks to the Figma API, returns plain serializable "raw" shapes
    transform/    Pure functions: raw Figma shapes -> normalized DesignSystem schema
    generators/   Pure functions: DesignSystem -> output file contents
    utils/        Async batching/yielding helpers for large files
  ui/           React UI running in the plugin iframe (src/ui -> dist/ui.html)
```

Everything downstream is generated from the normalized `DesignSystem` schema
(`src/shared/types.ts`) — never directly from Figma nodes — so every output format stays
consistent and the transform/generator layers are unit-testable without a Figma runtime.

## Performance

Extraction batches variables/styles/components (100–200 per batch) and yields to the
event loop between batches, so the plugin stays responsive on design systems with
10,000+ variables or 5,000+ components. Every extractor is independently wrapped in
try/catch — a single corrupted style or missing reference is recorded as a warning
(shown in the plugin UI) rather than aborting the whole run.

## Development

```bash
npm install
npm run build       # builds dist/ui.html and dist/code.js
npm test             # runs the vitest suite
npm run lint          # eslint
npm run typecheck      # tsc --noEmit (UI config + plugin sandbox config)
npm run format         # prettier --write
```

For iterative development, run `npm run watch:ui` and `npm run watch:code` in separate
terminals, then reload the plugin in Figma after each change.

## Loading the plugin in Figma

1. `npm install && npm run build`
2. In the Figma desktop app: **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` at the repo root.
4. Run **Plugins → Development → DesignMD** from any file.

## Project structure notes

- `vite.config.code.ts` builds `src/plugin/main.ts` into a single IIFE (`dist/code.js`)
  that runs in Figma's plugin sandbox (no DOM).
- `vite.config.ui.ts` builds `src/ui` into a single self-contained HTML file
  (`dist/ui.html`, via `vite-plugin-singlefile`) since the plugin iframe cannot load
  external assets.
- `tsconfig.json` covers the UI (DOM lib); `tsconfig.plugin.json` covers the plugin
  sandbox (`@figma/plugin-typings`, no DOM) — kept separate because the two runtimes
  have incompatible global types.
