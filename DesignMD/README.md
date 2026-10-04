# DesignMD

A Figma plugin that deterministically extracts a design system — Variables, Styles, and
Components — into developer-ready documentation and token files. No AI, no backend, no
network access: everything runs locally inside the Figma plugin sandbox, and it's free
forever with no feature gating.

## What it generates

| File                 | Contents                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `design.md`          | Overview, variable collections, color/typography/spacing/effect/grid tokens, component index, accessibility notes, naming conventions |
| `components/*.md`    | One Markdown file per component/component set — variants, sizes, states, properties, token references, related components             |
| `tokens.json`        | Normalized, nested token export (DTCG-style `$type`/`$value`), grouped by color/typography/spacing/effect/grid/semantic/component     |
| `css-tokens.json`    | CSS custom-property-ready export (`--color-primary-500`, etc.), including per-mode overrides                                          |
| `tokens.css`         | The same custom properties as a ready-to-import stylesheet: `:root` defaults plus a `[data-theme="<mode>"]` block per extra mode      |
| `_tokens.scss`       | Sass variables (aliases stay references) plus a `$modes` map of per-mode differences                                                  |
| `tailwind.tokens.js` | A Tailwind preset whose theme values are `var(--token)` references, so modes switch through `tokens.css`                              |

Color contrast in `design.md` is checked separately for every color mode (Light, Dark, …), and
component docs include a Layout section (size, auto layout, gap, padding, corner radius) measured
from the default variant.

In the plugin you can scan the **whole file** or only the **selected layers** (components inside
the selection; variables and styles stay file-wide), preview and copy any generated file before
downloading, and your output choices are remembered between sessions.

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

### Testing against a fake Figma

The extraction layer and the plugin controller (`src/plugin/main.ts`) are tested without Figma
using an in-memory stand-in for the Plugin API: `tests/unit/helpers/fakeFigma.ts`. Build a
document with `document` / `page` / `frame` / `component` / `componentSet`, add variables, styles
and optional `failures`, then call `installFakeFigma(...)` — it exposes the global `figma`, and the
real extraction code runs against it:

```ts
const handle = installFakeFigma({
  root: document('My File', [
    page('Buttons', [componentSet('Button', [{ props: { Size: 'L' } }])]),
  ]),
  collections: [fakeCollection({ variableIds: ['v1'] })],
  variables: [fakeVariable({ id: 'v1' })],
});
const raw = await extractDesignSystem();
```

Call `vi.unstubAllGlobals()` in `afterEach`, and build a fresh document per test (the tree is mutable).

### Self-test with real Figma nodes

The fake API can't prove that selection scanning behaves the same on real nodes, so there is a
small companion plugin that does. It builds components, nested frames and a component set on a
temporary page, selects them the way a user would, runs the production `extractComponents` over the
real selection, and removes the page again.

1. `npm run build` (this also writes `dist/selftest.js`).
2. In the Figma desktop app: **Plugins › Development › Import plugin from manifest…** and pick
   `manifest.selftest.json`.
3. Run **DesignMD self-test** from the Development plugins menu. It reports "all N checks passed",
   or "N of M FAILED" with details in **Plugins › Development › Open console**.

The same checks run against the fake API in `tests/unit/extraction/selftest.test.ts`, so a mistake
in the self-test itself shows up in `npm test` first.
