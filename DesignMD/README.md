# DesignMD

A Figma plugin that deterministically extracts a design system — Variables, Styles, and
Components — into developer-ready documentation and token files. No AI, no backend, no
network access: everything runs locally inside the Figma plugin sandbox, and it's free
forever with no feature gating.

## What it generates

| File              | Contents                                                                                                                                                                                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `design.md`       | Overview, variable collections, color/typography/spacing/effect/grid tokens, component index, token and style usage, accessibility notes (contrast per color mode), naming conventions                                                                                                                             |
| `components/*.md` | One Markdown file per component/component set: variants, sizes, states, layout, properties, token references, related components                                                                                                                                                                                   |
| `tokens.json`     | Nested W3C-style design tokens (`$type`/`$value`): real `color`, `dimension`, `fontWeight`, `fontFamily`, `typography` and `shadow` types, aliases that point at real token paths, plus modes                                                                                                                      |
| `tokens.css`      | The same custom properties as a ready-to-import stylesheet: `:root` defaults, a `[data-theme="<mode>"]` block per extra mode, and a `prefers-color-scheme` rule for dark                                                                                                                                           |
| `components.json` | Per component: the layer tree of the default variant (auto layout, fills, strokes, effects, text, instances, token bindings, inferred roles), how every other variant differs, full property details, and the tokens used. Schema `designmd.components/v1`, see [docs/components-json.md](docs/components-json.md) |

`design.md` and the component docs are on by default; the token files are opt-in. Variables are
the source of truth: when a category has no variables (e.g. no color variables), the
corresponding Styles (Paint/Text/Effect/Grid) are used as a fallback and the output says so.

Each token in `tokens.json` carries its CSS name (`$extensions.figma.cssName`), its Figma id
(`$extensions.figma.id`) and its value in every mode (`$extensions.figma.modes`).

**Using the tokens with Tailwind.** Import `tokens.css`, then map the variables in your Tailwind v4
CSS config:

```css
@import 'tailwindcss';
@import './tokens.css';

@theme inline {
  --color-primary: var(--color-primary-500);
}
```

With Tailwind v3, point `theme.extend` at the same `var(--…)` names.

`components.json` is opt-in and read from your layers only when selected. It contains text content,
layer names and design values from your file; turn off **Include text content** to leave the text out.
Nothing leaves the plugin.

### What the docs cover

- **Contrast per mode.** WCAG 2.1 contrast is checked separately for every color mode (Light,
  Dark, …), because a pair that passes in Light can fail in Dark. Foreground/background roles are
  inferred from token names and scopes, and you can add your own pairs (see below). In large
  systems, pairs are inferred only within a group, and tokens that name a state (Default, Hover,
  Pressed, Active, Disabled, Focus) are paired only with backgrounds in the same state. The worst
  500 pairs are reported with exact totals.
- **Usage.** Which components use each variable, including variables bound inside the text, color
  and effect styles a component applies, and which styles are not applied in any component.
- **Layout.** Each component doc has a Layout section (size, auto layout, gap, padding, corner
  radius) measured from the default variant.
- **Hidden from publishing.** Components, variables and collections hidden from publishing (a
  hidden flag, or a name starting with `.`) are skipped, and aliases to hidden variables are
  replaced by their values so nothing dangles.

## Using the plugin

Run the plugin, choose a scope, and press **Scan**. After a scan the panel has four tabs:

| Tab          | What's in it                                                                                                                                    |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Summary**  | Scan scope, counts of collections, variables, components, styles and modes, extraction warnings, and **Include pages** to leave out draft pages |
| **Contrast** | Add foreground/background pairs to check in every mode, with a live ratio and verdict. Hidden when the file has fewer than two color tokens     |
| **Export**   | File name, the outputs to generate (Documentation, Tokens and code, Components), and the ZIP option                                             |
| **Files**    | Appears after generating: a file list with sizes, a code preview (first 300 lines) and **Copy**, before you download                            |

- **Scope.** Scan the **whole file**, or only the **selected layers**: components inside the
  selection (a selected variant stands for its whole set). Variables and styles stay file-wide,
  and `design.md` records which scope was used.
- **Remembered.** Your output choices are saved per user. Excluded pages and contrast pairs are
  saved per file (keyed by file name) and restored next time, ignoring pages that no longer exist.
- **Stale results.** Changing outputs, excluded pages or contrast pairs after generating drops the
  Files tab and asks you to generate again; toggling ZIP does not, since it only changes how files
  are downloaded.

## Architecture

```
src/
  shared/       Normalized DesignSystem schema, UI<->plugin message protocol, settings validation
  plugin/       Runs in the Figma plugin sandbox (src/plugin/main.ts -> dist/code.js)
    extraction/   Talks to the Figma API, returns plain serializable "raw" shapes
    transform/    Pure functions: raw shapes -> normalized DesignSystem (usage, hidden filtering, page filter)
    generators/   Pure functions: DesignSystem -> output file contents
      designMd/     design.md, one file per section
    selftest/     Real-node self-test plugin (src/plugin/selftest -> dist/selftest.js)
    utils/        Async batching/yielding helpers for large files
  ui/           React UI running in the plugin iframe (src/ui -> dist/ui.html)
tests/
  unit/         Transform, generator and extraction tests (extraction runs against a fake Figma API)
  ui/           React Testing Library tests of the whole UI flow
DESIGN.md       The UI's design system (tokens, components, rules) for people and AI tools
.impeccable/    Machine-readable sidecar for DESIGN.md
```

Everything downstream is generated from the normalized `DesignSystem` schema
(`src/shared/types.ts`) — never directly from Figma nodes — so every output format stays
consistent and the transform/generator layers are unit-testable without a Figma runtime.

## Performance

Extraction batches variables, styles and components (100–200 per batch), runs the lookups inside
a batch concurrently, and yields to the event loop between batches, so the plugin stays
responsive on design systems with 10,000+ variables or 5,000+ components. Every extractor is
independently wrapped in try/catch: a single corrupted style or missing reference is recorded as
a warning (shown in the plugin UI) rather than aborting the whole run. Each component's layers
are scanned up to a budget (500 layers, 10 levels deep) and a warning is shown when a component
exceeds it, since its token usage may then be under-reported.

**Whole-file scans.** Scanning a large design-system file is a normal case, so every step is bounded
and none of them can take the plugin down:

- **Budgets.** `components.json` reads each component's layers inside the same budget (500 layers,
  10 levels), plus a 20 s time budget (checked per layer) and a 4 MB budget for its serialized variant diffs, inside a
  10-minute budget for the whole run. A component
  that goes over is written with `treeTruncated: true` and a warning, never skipped silently. Sets
  with more than 512 variants get no diffs (a warning says so).
- **Scanning.** The scan is also sliced: pages are loaded and searched one at a time (the progress bar names the page, so a stall can be pinned to it; `loadAllPagesAsync` was one call that cannot be interrupted and locked Figma on a very large file), a component's
  bindings are read in short stretches, and components go in batches of 20. The plugin console prints
  how long each stage took (`[DesignMD] scan: variables … components …`).
- **Isolation.** Each component is read on its own. One that cannot be found, throws, or has
  unreadable properties becomes a warning (`COMPONENT_FAILED`, `PROPERTIES_UNREADABLE`) and the scan
  continues.
- **Progress and Cancel.** The scan and the layer reading show "done of total" and a **Cancel**
  button. Cancelling returns what is finished with a warning (`SCAN_CANCELLED` on the components not
  read), not an error.
- **Keeping Figma responsive.** Plugin code runs on Figma's main thread, so a long stretch of it
  freezes the editor. Reading component layers is time-sliced (it hands control back about every
  12 ms), and the heavy part of `components.json` (assembling, hashing and splitting a file that can
  be tens of megabytes) runs in the plugin's UI iframe instead of the plugin. The plugin only reads
  from Figma and streams the results over.
- **Large results.** Other results over 2 MB are sent from the plugin to the UI in 512 KB pieces. If
  `components.json` would pass 20 MB it is split automatically: `components.json` keeps the index and
  tokens, and each component gets its own valid file in `components/<name>.json`.
- **Partial success.** If one output fails to generate, the others are still offered and the Files
  tab says which failed and why.

### Large-file checks

| File                                                                                                       | Components | Time                                                                                      | Heap growth  | `components.json`                                                     |
| ---------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------- |
| Synthetic (40 sets x 100 variants, 960 standalone, deep and wide)                                          | 1,000      | ~5 s                                                                                      | ~130 MB      | 37.6 MB (unsplit)                                                     |
| Rayna UI community file (500 components and sets, 2,581 with variants), variant differences on             | 2,581      | layers read in 16 s (2,174 trees, 34,790 layers); Figma stayed responsive                 | not measured | 23.8 MB, split into 501 files                                         |
| Bootstrap 5 UI kit community file (2,370 components and sets, 6,527 with variants), variant differences on | 6,527      | scan 12-14.5 s; layers read in 34 s (6,527 trees, 32,521 layers); Figma stayed responsive | not measured | about 35 MB, split into 2,371 files; ZIP about 3.5 MB when compressed |

The synthetic file runs against the fake Figma API in `tests/unit/stress.test.ts` (limits: 30 s,
600 MB heap). The Rayna UI row is a manual run in Figma with `components.json` selected, made before layer reading
was time-sliced and before `components.json` was assembled in the UI: the scan took 8.5 s and
generating took 3 min 36 s, and Figma froze while it ran. The plugin console reported 1,173 layer
trees (28,819 layers) read in 17 s, with 5,722 instance lookups adding up to 35 s of overlapping
waits, so reading was not where most of the time went. Profiling the synthetic file in Node showed
hashing its 36 MB output alone takes about 2 s with a JIT; the plugin's interpreter is much
slower, which is the likely cause of the freeze. That run needs repeating with this version.
Heap growth and output size were not recorded, and the generated file has not been checked yet. After a generate, the plugin console (Plugins > Development > Open
console) prints how many layers were read and how long instance lookups took. The README's earlier
claim that 10,000+ variables and 5,000+ components stay responsive has not been measured.

## Development

```bash
npm install
npm run build          # dist/ui.html, dist/code.js and dist/selftest.js
npm test                # runs the vitest suite (unit + UI)
npm run lint            # eslint
npm run typecheck       # tsc --noEmit (UI config + plugin sandbox config)
npm run format          # prettier --write
```

For iterative development, run `npm run watch:ui` and `npm run watch:code` in separate
terminals, then reload the plugin in Figma after each change.

### Loading the plugin in Figma

1. `npm install && npm run build`
2. In the Figma desktop app: **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json` at the repo root.
4. Run **Plugins → Development → DesignMD** from any file.

### Project structure notes

- `vite.config.code.ts` builds `src/plugin/main.ts` into a single IIFE (`dist/code.js`)
  that runs in Figma's plugin sandbox (no DOM).
- `vite.config.ui.ts` builds `src/ui` into a single self-contained HTML file
  (`dist/ui.html`, via `vite-plugin-singlefile`) since the plugin iframe cannot load
  external assets.
- `vite.config.selftest.ts` builds the self-test plugin (`dist/selftest.js`).
- `tsconfig.json` covers the UI (DOM lib); `tsconfig.plugin.json` covers the plugin
  sandbox (`@figma/plugin-typings`, no DOM), kept separate because the two runtimes
  have incompatible global types.
- `dist/` is committed on purpose: the plugin is also loaded from a "Download ZIP" of the
  monorepo on machines that can't run npm.

## Testing

### Against a fake Figma

The extraction layer and the plugin controller (`src/plugin/main.ts`) are tested without Figma
using an in-memory stand-in for the Plugin API: `tests/unit/helpers/fakeFigma.ts`. Build a
document with `document` / `page` / `frame` / `component` / `componentSet`, add variables, styles
and optional `failures`, then call `installFakeFigma(...)`. It exposes the global `figma`, and the
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

It also models selection, `figma.on`, `clientStorage` and node creation. Call
`vi.unstubAllGlobals()` in `afterEach`, and build a fresh document per test (the tree is mutable).

### The UI

`tests/ui` renders the real `App` with jsdom and React Testing Library and plays the plugin's side
of the message protocol: scanning and scope, saved settings, tabs (including keyboard navigation),
contrast pairs, per-file settings, file preview and copy, and stale-result handling.

### Self-test with real Figma nodes

The fake API can't prove that selection scanning behaves the same on real nodes, so a small
companion plugin does. It builds components, nested frames and a component set on a temporary
page, selects them the way a user would, runs the production `extractComponents` over the real
selection, and removes the page again.

1. `npm run build` (this also writes `dist/selftest.js`).
2. In the Figma desktop app: **Plugins › Development › Import plugin from manifest…** and pick
   `manifest.selftest.json`.
3. Run **DesignMD self-test** from the Development plugins menu. It reports "all N checks passed",
   or "N of M FAILED" with details in **Plugins › Development › Open console**.

The same checks run against the fake API in `tests/unit/extraction/selftest.test.ts`, so a mistake
in the self-test itself shows up in `npm test` first.

## Publishing to the monorepo

DesignMD lives in the `DesignMD/` folder of the `prabhu-cg/Figma-plugins` monorepo.
`npm run publish:monorepo` (or `bash scripts/publish-to-monorepo.sh "message"`) builds, copies
exactly the files git tracks here into the monorepo clone, and pushes. The clone's location
defaults to a path on the maintainer's machine; set `DESIGNMD_MONOREPO_DIR` to use another.

A local, unversioned `post-commit` hook may run the same script after every commit, so on that
machine a commit here is also a push to the monorepo.

## Design system

The panel's visual language ("The Field Notebook": white paper, hairline rules, one burnt-orange
accent) is documented in [`DESIGN.md`](./DESIGN.md), with tokens, components and do's and don'ts.
Read it before changing the UI; `.impeccable/design.json` is its machine-readable companion.
