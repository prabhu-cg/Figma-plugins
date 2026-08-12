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

## V2 additions (schema version 2)

V2 layers history, impact, and workflow features on top of the V1 pipeline
above without changing how scanning/diffing/classifying work at their core.

- **Rename detection** (`diff/structuralSignature.ts`,
  `diff/detectPossibleRenames.ts`): after `diffComponents`/`diffTokens`
  produce id-matched changes, a post-pass pairs any remaining
  `-added`/`-removed` changes that share a component/variable `key` or a
  structural signature (everything except name/id — properties, variants,
  structure shape for components; type/scopes/mode-shape for tokens), and
  links them via `Change.possibleRenameOf` for the UI to offer "Confirm
  rename" / "Treat as remove + add" (never auto-merged). This is also why
  `main.ts`'s `resolveComponentIds` re-runs `discoverComponents` against the
  baseline's stored scope on every scan (for scopes other than
  `"selection"`) instead of re-scanning the frozen id list captured at
  baseline time — a node with a genuinely new id (delete + recreate) would
  otherwise never be discovered as "added" at all, and rename pairing needs
  both sides present in the same diff.
- **Breaking-change engine** (`classifier/rules.ts`,
  `shared/utils/classification.ts`): the classification table now mirrors
  the product spec's explicit BREAKING / POTENTIALLY BREAKING / NON-BREAKING
  buckets (e.g. variant removal and token alias removal are definitively
  breaking, not just potential). `Change.manualClassification` lets a human
  override the deterministic output without discarding it —
  `getEffectiveClassification`/`getVerdictLabel` are the single place every
  UI surface and the changelog generator read the "real" classification
  from, so an override is honored everywhere consistently.
  `ChangeVerdict` (`"breaking" | "potentially-breaking" | "non-breaking" |
  "informational"`) is the only vocabulary ever shown to the user — never a
  confidence score.
- **Deprecation** (`shared/types/entity.ts`'s `TrackedEntity`,
  `mark-deprecated`/`unmark-deprecated` in `main.ts`): deprecation is
  manual, user-applied metadata decoupled from any one snapshot, so it's
  stored as a `TrackedEntity` record (keyed by component/token id, or a
  synthetic `id::variant::name` / `id::prop::name` key for variants and
  properties) in `Project.trackedEntities` rather than duplicated across
  snapshots. Marking something deprecated also appends a synthetic
  `category: "deprecated"` Change into the current baseline's latest
  ChangeSet (`appendSyntheticChange`), so deprecations flow through the
  existing changelog/history/dashboard aggregation with no parallel
  counting logic.
- **Review states** (`shared/types/entity.ts`'s `ReviewState`): replaces
  V1's boolean `reviewed` with `"unreviewed" | "reviewed" | "accepted" |
  "rejected"`, plus a `bulk-update-review` message for multi-select actions.
- **History** (`shared/utils/entityHistory.ts`): a logical entity's full
  history is reconstructed by walking `TrackedEntity.renameHistory` to
  collect every id it's ever had (a rename confirmation appends the prior
  id onto the *surviving* record, so one lookup already carries the whole
  chain), then collecting every `Change` across every `ChangeSet` matching
  those ids, grouped by the `Release` each ChangeSet was folded into
  (unreleased changes bucket separately). Entirely derived from data
  already in `Project` — no new persisted index.
- **Token dependency chains** (`shared/utils/tokenGraph.ts`): alias edges
  (`TokenModeValue.aliasTo`, unioned across modes) and direct component
  bindings (`ComponentSnapshot.tokens`) are both already-scanned data, so
  the forward/reverse alias graph, "what's the blast radius of changing
  this token" (`getTokenImpact`), and the downstream chain view
  (`buildTokenDependencyChain`) are all pure computation with zero new
  Figma calls. Real instance counts (vs. component names) are Phase 2 —
  see below.
- **Search** (`shared/utils/search.ts`): a flat index built from `Project`
  on every render, substring-matched — deliberately not fuzzy/AI matching.

### Deferred to Phase 2 / Phase 3

Full instance-based impact analysis (an opt-in document-wide
`findAllWithCriteria({types:["INSTANCE"]})` walk, since spec section 19
explicitly rules out scanning the whole document on every change) and
visual before/after component comparison (thumbnail capture via
`node.exportAsync()` at baseline time) are intentionally not part of V2's
first slice — both are real, separate scanning/storage subsystems. See the
plan history for the detailed design.
