# DSLog

**Design System Change tracker.** Know what changed.

DSLog is a free, local-first Figma plugin for tracking changes to Design
System components and design tokens. It requires no AI, no backend, no
authentication, no paid service, no external API, no telemetry, no
analytics, no network access, no subscription, and no account creation.
Everything runs locally inside Figma.

DSLog does not read Figma's native Version History. It maintains its own
lightweight snapshots ("baselines") of the components and variables you
choose to track, diffs the current state of your file against a baseline,
classifies what changed, and helps you turn that into a release with a
human-written changelog.

## Workflow

1. **Track** — choose which components (by selection, current page, or the
   whole document) and which variable collections to track.
2. **Create a baseline** — DSLog scans the tracked components/tokens and
   stores a normalized snapshot (`v1.0.0`, for example).
3. Keep working in Figma as normal.
4. **Scan for changes** — DSLog re-scans the tracked set and diffs it
   against the current baseline.
5. **Review changes** — each change is classified (Added / Changed /
   Removed, with a severity and breaking-change confidence) and can be
   annotated with a review note and a migration note.
6. **Create a release** — bundles the current change set into a named
   version, generates a baseline for the new state, and produces a
   Markdown + JSON changelog.
7. **Export** — copy the changelog to your clipboard or the raw
   Markdown/JSON text.

## Tech stack

- TypeScript (strict), React, Vite
- `@figma/plugin-typings`, `documentAccess: "dynamic-page"`, async Figma
  APIs throughout (`getNodeByIdAsync`, `getLocalVariablesAsync`,
  `loadAllPagesAsync`, etc.)
- No UI framework beyond React, no CSS framework — hand-written CSS using
  the DSLog brand palette
- No runtime dependencies beyond `react` / `react-dom`
- Vitest for unit tests

## Project layout

```
src/
├── plugin/           # runs in Figma's plugin sandbox (no DOM)
│   ├── scanner/       # discovers + reads components & variables from the Figma API
│   ├── snapshot/       # pure normalization of raw Figma data → typed snapshots
│   ├── diff/           # deterministic snapshot-to-snapshot diffing
│   ├── classifier/      # assigns category / severity / breaking confidence
│   ├── storage/         # clientStorage + document plugin-data persistence
│   ├── export/          # Markdown / JSON changelog generation
│   └── main.ts          # message router wiring the UI to everything above
├── ui/                # runs in the plugin iframe (React)
│   ├── pages/            # Overview, Track, Changes, Releases, Settings
│   ├── components/
│   ├── state/            # postMessage bridge + React context
│   └── styles/
└── shared/            # types, brand constants, storage schema validators
```

See `docs/architecture.md` for a deeper walkthrough and `docs/storage-schema.md`
for exactly what gets persisted and where.

## Building

```sh
npm install
npm run build
```

This produces `dist/code.js` (the plugin sandbox bundle) and `dist/ui.html`
(a single self-contained HTML file with the UI, its JS, and its CSS inlined
— required because Figma plugin UIs cannot load external network
resources). `manifest.json` already points at both.

Other scripts:

```sh
npm run typecheck   # tsc --noEmit
npm run test        # vitest run (unit tests, see tests/)
npm run dev         # vite build --watch (plugin sandbox bundle only)
```

## Loading the plugin in Figma

1. Run `npm run build`.
2. In the Figma desktop app: **Plugins → Development → Import plugin from
   manifest…**
3. Select `manifest.json` at the repository root.
4. Run **DSLog** from Plugins → Development.

After editing source, re-run `npm run build` and re-run the plugin in
Figma (Figma does not hot-reload plugin code).

## Testing

`npm run test` runs the Vitest suite (`tests/`), covering:

- snapshot normalization (components + tokens) and its deterministic
  hashing
- the diff engine (component add/remove/rename, variant/property
  add/remove, structural changes, token add/remove/rename/mode/alias/value
  changes)
- change classification against the rules in the product spec
- changelog (Markdown + JSON) generation and `include` filtering
- storage chunking and corruption/malformed-data recovery
- schema validation and migration
- three fixture datasets (`fixtures/small-ds.json`, `medium-ds.json`,
  `large-ds.json`, at 50/250/1000 components and 500/1000/2000 tokens) that
  exercise normalization and diffing at the scales called out in the
  product spec's performance requirements

## Non-goals (V1)

No AI, cloud database, login, analytics, telemetry, subscriptions,
payments, GitHub/Storybook/Slack integration, automatic publishing, Figma
Version History access, or automatic modification of components/variables.
DSLog is read-only with respect to your Design System assets.
