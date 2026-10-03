# Performance

How DSLog behaves on a large design system, what was measured, and what still needs measuring in real Figma.

## What "large" means here

`fixtures/large-ds.json`: 1,000 components and 2,000 tokens. The stress case is a global edit that touches every
component and token, which produces about 5,000 changes (a ~2 MB change set) and a ~4 MB baseline snapshot.
A rename storm (every id changes) produces about 6,000 changes.

## Results

Measured in Chrome against a mock plugin (the tab was in the background, so these cover script and layout, not
painting) and in Node against an in-memory stand-in for Figma's storage. Absolute numbers depend on the machine;
the shape of the curve is what matters.

### The Changes page (UI)

Time for one interaction, before → after:

| Changes | Open the page | One keypress (J) | Review (A) round trip | One search keystroke | DOM nodes |
|---|---|---|---|---|---|
| 250 | 209 → 79 ms | 63 → 22 ms | 222 → 43 ms | 45 → 23 ms | 2,240 → 966 |
| 1,000 | 480 → 79 ms | 229 → 22 ms | 649 → 45 ms | 194 → 15 ms | 8,615 → 966 |
| 5,000 | 1,065 → 144 ms | 769 → 23 ms | 3,010 → 64 ms | 1,062 → 21 ms | 42,115 → 966 |

Select-all at 5,000 went 1,103 → 47 ms and a filter change 695 → 49 ms. The cost no longer grows with the number
of changes. Three changes did this:

1. **Rows render a page (100) at a time**, loading the next page shortly before the end of the list scrolls into
   view. Counts, select-all, bulk apply, "next unreviewed" and keyboard navigation work on the whole list, not just
   the rendered rows; moving the selection past the rendered rows loads more first.
2. **Rows are memoised** and receive stable callbacks, so a review re-renders the changed row and the two rows whose
   selection changed, not every row.
3. **Review edits travel as patches.** The plugin used to answer every review with the whole project
   (baseline snapshots and every change set), which cost 90–125 ms just to copy into the UI at 2–4 MB, and made
   every change a new object so nothing could be memoised. It now sends a `changes-updated` message with the edited
   fields; the UI applies it with `applyChangePatches`, which keeps the identity of every untouched change.

### Storage (plugin)

| | Before | After |
|---|---|---|
| A review rewrites | the whole project (4.2 MB) | one change set (2 MB) |
| Review save, simulated store | ~350 ms | ~130 ms |
| Settings change | rewrites plugin data | writes no plugin data |
| After 20 scans of this size | 41.6 MB, 1,091 chunks | 4.2 MB (only the latest scan is kept) |
| Burst of 25 reviews | 25 saves | 1 save |
| Normalise + diff the large fixture | 35 ms + 19 ms (global edit), 90 ms (rename storm) | unchanged |
| Rollback backup (`JSON.stringify`) | 12 ms at 4 MB | unchanged |
| `loadProject` | 12 ms | 12 ms |

What changed: the plugin-data blob was split into one part per baseline snapshot and per change set, and a save
writes only the parts that changed (see `docs/storage-schema.md`); superseded scans are pruned; and background
saves wait about 120 ms so a burst is saved once. The "simulated store" is an in-memory fake that also checks entry
sizes, so its absolute time is pessimistic. **Real Figma write cost is not measured** — see below.

## Reproducing

The numbers above came from throwaway harnesses, deliberately not committed (they depend on a browser tab and a
large generated project). To redo them:

- **Plugin side:** build a project from `fixtures/large-ds.json` with `normalizeComponent` / `normalizeToken` and
  `diffSnapshots`, install the fake Figma from `tests/helpers/fakeFigma.ts`, then time `saveProject` after patching
  one change with `applyChangePatches`. `setSaveLogger` reports parts and bytes written per save.
- **UI side:** serve `dist/ui.html`, post a `state` message holding a project with N changes, open Changes, and time
  keypresses (dispatch `keydown` on `window`) with a forced layout read. A mock plugin should answer
  `update-change` with a `changes-updated` patch, as the real one does.

## Still to measure in real Figma

These can't be measured outside Figma. The plugin logs one line per save that wrote something:

    [DSLog] saved 1 of 4 parts (1971 KB) in 84 ms

(Figma ▸ Plugins ▸ Development ▸ Open console; it is a `console.debug` line, so enable the Verbose level.)

A checklist for a real large file:

1. **Save time.** Open DSLog on a file with ~1,000 components, create a baseline, scan after a global edit, then
   review 20 changes with A/R/V. Note the logged `ms` for the first save and for review saves. Anything much above
   the simulated ~130 ms for ~2 MB points at `setPluginData` itself being slow.
2. **File size.** Compare the `.fig` file size before and after creating a baseline and a few releases. Plugin data
   lives inside the document; each release keeps a ~4 MB snapshot and a change set.
3. **Chunk count.** A 4 MB snapshot is ~110 plugin-data entries of 40 KB. Check whether very many entries slow
   `figma.root.getPluginDataKeys()` (used by the clean-up sweep after a manifest change).
4. **Keyboard focus.** Confirm A/R/V/J/K/N/Z reach the page inside Figma's plugin iframe and don't trigger canvas
   tool shortcuts.
5. **Closing right after a review.** Press A, then close the plugin immediately: the review should still be there
   when reopened (the pending save is flushed on `close`, but Figma may cut async work short).
6. **Opening an older file.** A file saved by a previous DSLog version should open, keep its data, drop superseded
   scans, and re-save in the new layout (the old `dslog:heavy` entries disappear).
