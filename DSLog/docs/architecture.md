# Architecture

## Two runtimes, one message protocol

A Figma plugin is two separate JavaScript environments that only talk to
each other through `postMessage`:

- **Plugin sandbox** (`src/plugin/main.ts`, built to `dist/code.js`): has
  access to the `figma` global and the document, but no DOM.
- **UI iframe** (`src/ui/`, built to `dist/ui.html`): a normal React app
  with a DOM, but no access to `figma`.

`src/shared/types/messages.ts` defines the full `UiToPluginMessage` /
`PluginToUiMessage` discriminated unions that cross that boundary, so both
sides are typed against the same contract. `src/ui/state/bridge.ts` wraps
`parent.postMessage` / `window.onmessage`; `src/plugin/main.ts` wraps
`figma.ui.postMessage` / `figma.ui.onmessage`.

## Why the plugin code is split the way it is

Figma's node/variable APIs are large, mutable, and impossible to unit test
without a running Figma instance. To keep the core logic testable with
plain Vitest (no Figma runtime required), the plugin code is split into a
layer that touches `figma.*` and a layer that doesn't:

- **`scanner/`** is the only place that calls real Figma APIs
  (`getNodeByIdAsync`, `getLocalVariablesAsync`, `findAllWithCriteria`,
  etc). It adapts real nodes/variables into small duck-typed shapes
  (`NodeLike`, `ComponentInputLike`, `VariableInputLike` — see
  `scanner/types.ts`) that describe exactly the fields DSLog reads.
- **`snapshot/`** normalizes those duck-typed shapes into the serializable
  `ComponentSnapshot` / `TokenSnapshot` types from `shared/types`, and
  computes a deterministic content hash for each (`shared/utils/hash.ts`,
  FNV-1a over a key-sorted JSON stringification). Because normalization
  takes plain objects, not live Figma nodes, it's fully unit-testable —
  see `tests/normalizeComponent.test.ts` / `tests/normalizeToken.test.ts`.
- **`diff/`** compares two `DesignSystemSnapshot`s (component arrays
  matched by node id, token arrays matched by variable id) and emits
  `RawChange[]` — unclassified, machine-readable diffs
  (`changeType`, `field`, `before`/`after`). The component structural diff
  (`diffStructure.ts`) matches children across snapshots by sibling name
  and recurses, so renamed/reordered layers don't get misread as
  unrelated adds+removes.
- **`classifier/`** maps each `RawChange` to a `Change` — assigning
  `category` (added/removed/modified/deprecated), `severity`
  (info/minor/major), and a `breaking` / `potentialBreaking` verdict via a
  lookup table (`classifier/rules.ts`) that mirrors the product spec's
  classification rules. `breaking: true` means DSLog is confident;
  `potentialBreaking: true` means it isn't and the UI must say so rather
  than assert certainty.
- **`storage/`** persists a `Project` (baselines, releases, change sets,
  settings) across two Figma storage backends — see
  `docs/storage-schema.md`.
- **`export/`** turns a change set + release metadata into Markdown and
  JSON changelogs.
- **`main.ts`** is the only file that wires these together against real
  `figma.*` calls and the UI message protocol. It intentionally contains
  little logic of its own — scanning, diffing, and classifying all happen
  in the layers above.

## Scan → diff → release flow

1. **Track setup** (`ui/pages/TrackPage.tsx`) sends `discover-components`
   (scope: selection / current page / document) to enumerate candidate
   `COMPONENT`/`COMPONENT_SET` nodes, then `create-baseline` with the
   user's final checked list plus token-tracking config.
2. `main.ts` scans the tracked components (`scanner/scanComponents.ts`,
   batched via `SCAN_BATCH_SIZE` with progress callbacks) and tracked
   variable collections (`scanner/scanTokens.ts`), builds a
   `DesignSystemSnapshot`, wraps it in a `Baseline`, and diffs it against
   an empty snapshot (so the first baseline's "changes" are all `added` —
   useful for the initial changelog).
3. **Scan for changes** (Overview) re-runs the same scan against the
   *current* baseline's tracked ids and diffs the result — this is the
   core "what changed since the baseline" flow.
4. **Create release** re-scans once more (to capture the latest state),
   diffs it against the current baseline, generates the Markdown/JSON
   changelog from that change set, and promotes the newly scanned state
   into a **new** baseline (`previousBaselineId` links back to the old
   one). This is what makes releases behave like check-points: the next
   scan diffs against the release, not against v1.0.0 forever.

## Performance approach

Component and token scanning both run in batches
(`scanner/scanComponents.ts`, `scanner/scanTokens.ts`) with progress
callbacks posted to the UI (`scan-progress` messages), so the UI can render
a live "142 / 350" counter instead of freezing. A single component or
variable that throws during scanning (deleted node, inaccessible remote
asset, malformed data) is caught and recorded in `scanSummary.skippedItems`
rather than aborting the whole scan — see the "skipped items" disclosure on
the Changes page.

`fixtures/{small,medium,large}-ds.json` provide synthetic datasets at
50/250/1000 components and 500/1000/2000 tokens (the scales called out in
the product spec) for exercising normalization and diffing at scale in
`tests/fixtures.test.ts`.
